const test = require('node:test');
const assert = require('node:assert/strict');
const { RequestBeam, SDKError, APIError } = require('../dist/index.js');

const encoder = new TextEncoder();
const collect = async (iterable) => {
    const events = [];
    for await (const event of iterable) events.push(event);
    return events;
};
function streamingClient(text, { chunkSize = 7, leaveOpen = false, timeoutMs = 1000 } = {}) {
    let cancelled = false;
    let init;
    const bytes = encoder.encode(text);
    const stream = new ReadableStream({
        start(controller) {
            for (let offset = 0; offset < bytes.length; offset += chunkSize) controller.enqueue(bytes.slice(offset, offset + chunkSize));
            if (!leaveOpen) controller.close();
        },
        cancel() { cancelled = true; },
    });
    const client = new RequestBeam({ apiKey: 'mock-key', timeoutMs, fetch: async (_url, options) => {
        init = options;
        return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    } });
    return { client, get cancelled() { return cancelled; }, get init() { return init; } };
}

test('chat SSE handles BOM, UTF-8 boundaries, comments, multiline data and persistent IDs', async () => {
    const text = '\uFEFF: comment\r\nid: retained\r\nevent: delta\r\ndata: {"text":\r\ndata: "你好"}\r\n\r\ndata: {"text":"next"}\r\n\r\ndata: [DONE]\r\n\r\n';
    const mocked = streamingClient(text, { chunkSize: 1 });
    const payload = Object.freeze({ model: 'example', messages: [] });
    const events = await collect(mocked.client.streamChatCompletions(payload));
    assert.equal(events.length, 2);
    assert.equal(events[0].event, 'delta');
    assert.equal(events[0].id, 'retained');
    assert.deepEqual(events[0].json(), { text: '你好' });
    assert.equal(events[1].event, 'message');
    assert.equal(events[1].id, 'retained');
    assert.equal(JSON.parse(mocked.init.body).stream, true);
    assert.equal(payload.stream, undefined);
    assert.equal(new Headers(mocked.init.headers).get('accept'), 'text/event-stream');
});

test('SSE accepts LF, CRLF and bare CR separators across chunks', async () => {
    for (const newline of ['\n', '\r\n', '\r']) {
        const mocked = streamingClient(`data: {"value":1}${newline}${newline}data: [DONE]${newline}${newline}`, { chunkSize: 1 });
        const events = await collect(mocked.client.streamChatCompletions({}));
        assert.equal(events.length, 1);
        assert.deepEqual(events[0].json(), { value: 1 });
    }
});

test('protocol-specific terminal events close their streams', async () => {
    for (const [method, type, suffix] of [
        ['streamResponses', 'response.completed', ''],
        ['streamResponses', 'response.incomplete', ''],
        ['streamMessages', 'message_stop', ''],
        ['streamImage', 'image_generation.completed', 'data: [DONE]\n\n'],
    ]) {
        const mocked = streamingClient(`event: ${type}\ndata: {"type":"${type}"}\n\n${suffix}`, { leaveOpen: true });
        const events = await collect(mocked.client[method]({ model: 'example' }));
        assert.equal(events.length, 1);
        assert.equal(events[0].json().type, type);
        assert.equal(mocked.cancelled, true);
    }
});

test('images require completion and DONE, and all unexpected EOFs fail', async () => {
    for (const [method, body] of [
        ['streamImage', 'data: [DONE]\n\n'],
        ['streamImage', 'data: {"type":"image_generation.completed"}\n\n'],
        ['streamChatCompletions', 'data: {"choices":[]}\n\n'],
        ['streamChatCompletions', 'data: [DONE]'],
        ['streamMessages', 'data: {"type":"message_delta"}\n\n'],
        ['streamResponses', 'data: {"type":"response.output_text.delta"}\n\n'],
    ]) {
        const mocked = streamingClient(body);
        await assert.rejects(() => collect(mocked.client[method]({})), SDKError);
    }
});

test('HTTP 200 stream errors retain provider metadata and bodies', async () => {
    for (const [method, body] of [
        ['streamChatCompletions', { error: { code: 'original-code', message: 'original message' } }],
        ['streamChatCompletions', { success: false, error: { code: 40000, message: 'original message' } }],
        ['streamResponses', { type: 'response.failed', response: { error: { code: 'failed', message: 'original message' } } }],
        ['streamMessages', { type: 'error', error: { type: 'overloaded_error', message: 'original message' } }],
    ]) {
        const mocked = streamingClient(`data: ${JSON.stringify(body)}\n\n`, { leaveOpen: true });
        await assert.rejects(() => collect(mocked.client[method]({})), (error) => {
            assert.ok(error instanceof APIError);
            assert.equal(error.message, 'original message');
            assert.deepEqual(error.body, body);
            return true;
        });
        assert.equal(mocked.cancelled, true);
    }
});

test('error event name is checked even without error fields in JSON', async () => {
    const mocked = streamingClient('event: error\ndata: {"message":"error event"}\n\n');
    await assert.rejects(() => collect(mocked.client.streamChatCompletions({})), APIError);
});

test('malformed stream JSON raises a protocol error', async () => {
    const mocked = streamingClient('data: {bad JSON}\n\ndata: [DONE]\n\n');
    await assert.rejects(() => collect(mocked.client.streamChatCompletions({})), SDKError);
});

test('stream preserves unsafe numeric IDs losslessly', async () => {
    const mocked = streamingClient('data: {"id":1234567890123456789}\n\ndata: [DONE]\n\n');
    const events = await collect(mocked.client.streamChatCompletions({}));
    assert.equal(events[0].json().id, '1234567890123456789');
});

test('early iterator return cancels body reader', async () => {
    const mocked = streamingClient('data: {"choices":[]}\n\n', { leaveOpen: true });
    for await (const event of mocked.client.streamChatCompletions({})) {
        assert.equal(event.event, 'message');
        break;
    }
    assert.equal(mocked.cancelled, true);
});

test('non-SSE HTTP responses do not appear as successful streams', async () => {
    const client = new RequestBeam({ apiKey: 'mock-key', fetch: async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }) });
    await assert.rejects(() => collect(client.streamChatCompletions({})), SDKError);
});

test('stream errors from HTTP status retain structured API error', async () => {
    const client = new RequestBeam({ apiKey: 'mock-key', fetch: async () => new Response('{"error":{"message":"limited"}}', { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '3' } }) });
    await assert.rejects(() => collect(client.streamChatCompletions({})), (error) => {
        assert.ok(error instanceof APIError);
        assert.equal(error.statusCode, 429);
        assert.equal(error.retryAfter, '3');
        return true;
    });
});

test('timeout covers a stalled stream body, not only fetch headers', { timeout: 1500 }, async () => {
    const mocked = streamingClient('data: {"choices":[]}\n\n', { timeoutMs: 25, leaveOpen: true });
    await assert.rejects(() => collect(mocked.client.streamChatCompletions({})), SDKError);
    assert.equal(mocked.cancelled, true);
});

test('caller abort interrupts a stalled stream and releases reader', { timeout: 1500 }, async () => {
    const mocked = streamingClient('data: {"choices":[]}\n\n', { timeoutMs: 1000, leaveOpen: true });
    const controller = new AbortController();
    const events = mocked.client.streamChatCompletions({}, { signal: controller.signal });
    await events.next();
    const pending = events.next();
    controller.abort();
    await assert.rejects(() => pending);
    assert.equal(mocked.cancelled, true);
});

test('timeout covers a stalled JSON body and cancels its reader', { timeout: 1500 }, async () => {
    let cancelled = false;
    const body = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('{"partial":')); }, cancel() { cancelled = true; } });
    const client = new RequestBeam({ apiKey: 'mock-key', timeoutMs: 25, fetch: async () => new Response(body) });
    await assert.rejects(() => client.listModels(), SDKError);
    assert.equal(cancelled, true);
});
