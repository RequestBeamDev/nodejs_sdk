const test = require('node:test');
const assert = require('node:assert/strict');
const {
    RequestBeam, SDKError, APIError, JobFailedError, PollingTimeoutError,
    supportedLocales, similarwebOperations, parseJSON,
} = require('../dist/index.js');

const key = 'test-key-not-a-real-credential';
const json = (body, init = {}) => new Response(JSON.stringify(body), {
    ...init, headers: { 'content-type': 'application/json', ...init.headers },
});
function mockClient(responder = () => json({ ok: true }), options = {}) {
    const calls = [];
    const client = new RequestBeam({ apiKey: key, ...options, fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return responder(url, init, calls.length);
    } });
    return { client, calls };
}
const collect = async (iterable) => {
    const values = [];
    for await (const value of iterable) values.push(value);
    return values;
};

test('all public JSON helpers use the documented routes and native payloads', async () => {
    const { client, calls } = mockClient();
    const payload = Object.freeze({ model: 'configured-model', messages: [{ role: 'user', content: 'Hello' }], custom: 'unchanged' });
    for (const [method, path] of [
        ['chatCompletions', '/v1/chat-completions'],
        ['responses', '/openai/responses'],
        ['messages', '/anthropic/v1/messages'],
        ['generateImage', '/openai/v1/images/generations'],
        ['generateVideo', '/v1/video/seedance'],
    ]) {
        assert.deepEqual(await client[method](payload), { ok: true });
        const call = calls.at(-1);
        assert.equal(call.url, `https://api.requestbeam.com${path}`);
        assert.equal(call.init.method, 'POST');
        assert.deepEqual(JSON.parse(call.init.body), payload);
        assert.equal(new Headers(call.init.headers).get('authorization'), `Bearer ${key}`);
        assert.ok(['manual', 'error'].includes(call.init.redirect));
    }
    await client.listModels();
    assert.equal(calls.at(-1).url, 'https://api.requestbeam.com/v1/models');
    assert.equal(calls.at(-1).init.method, 'GET');
});

test('JSON generation methods reject streaming without making a request', async () => {
    const { client, calls } = mockClient();
    for (const method of ['chatCompletions', 'responses', 'messages', 'generateImage']) {
        await assert.rejects(async () => client[method]({ stream: true }), SDKError);
    }
    assert.equal(calls.length, 0);
});

test('data helpers preserve query values, native response envelope, and exact identifiers', async () => {
    const { client, calls } = mockClient(() => json({ data: [], meta: { result_count: 0 } }));
    const query = Object.freeze({ 'tweet.fields': 'created_at,text', max_results: 5, pagination_token: 'a+b & c' });
    const id = '1234567890123456789';
    await client.twitterUserByUsername('name with space', query);
    assert.equal(new URL(calls.at(-1).url).searchParams.get('username'), 'name with space');
    await client.twitterUser(id, query);
    assert.equal(new URL(calls.at(-1).url).pathname, `/v1/twitter/users/${id}`);
    assert.deepEqual(await client.twitterUserTweets(id, query), { data: [], meta: { result_count: 0 } });
    const url = new URL(calls.at(-1).url);
    assert.equal(url.pathname, `/v1/twitter/users/${id}/tweets`);
    assert.equal(url.searchParams.get('pagination_token'), 'a+b & c');
    assert.equal(url.searchParams.get('tweet.fields'), 'created_at,text');
    await client.getJob(id);
    assert.equal(new URL(calls.at(-1).url).pathname, `/v1/jobs/${id}`);
});

test('all 27 Similarweb operations preserve exact query parameters', async () => {
    const { client, calls } = mockClient();
    assert.equal(similarwebOperations.length, 27);
    assert.equal(new Set(similarwebOperations).size, 27);
    const query = Object.freeze({ key: 'example.com', country: 999, from: '2026-08-01', to: '2026-08-31', latest: '1m', OrderBy: 'TotalVisits desc' });
    for (const operation of similarwebOperations) {
        await client.similarweb(operation, query);
        const url = new URL(calls.at(-1).url);
        assert.equal(url.pathname, `/v1/similarweb/${operation}`);
        assert.equal(url.searchParams.get('country'), '999');
        assert.equal(url.searchParams.get('from'), query.from);
        assert.equal(url.searchParams.get('latest'), '1m');
        assert.equal(url.searchParams.get('OrderBy'), 'TotalVisits desc');
    }
    await client.similarweb('/v1/similarweb/websites/visits', { keys: 'example.com' });
    await assert.rejects(async () => client.similarweb('unknown', {}), SDKError);
    assert.equal(calls.length, 28);
});

test('unsafe IDs are rejected locally rather than rounded or inserted into paths', async () => {
    const { client, calls } = mockClient();
    for (const id of [123, '', '../123', '123?x=1', '123/456', '１２３', '1e3', '-1']) {
        for (const method of ['getJob', 'twitterUser', 'twitterUserTweets']) {
            await assert.rejects(async () => client[method](id), SDKError);
        }
    }
    assert.equal(calls.length, 0);
});

test('base origins and generic request paths cannot redirect credentials', async () => {
    for (const baseURL of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/v1', 'https://example.com?x=1', 'https://example.com#fragment']) {
        assert.throws(() => new RequestBeam({ apiKey: key, baseURL }), SDKError);
    }
    const { client, calls } = mockClient();
    for (const path of ['https://evil.example/', '//evil.example/', '/\\evil.example', '/x/../secrets', '/x/%2e%2e/secrets', '/%252f%252fevil.example', '/v1/models?key=1', '/v1/models#hash', '/x\n']) {
        await assert.rejects(async () => client.request('GET', path), SDKError);
    }
    assert.equal(calls.length, 0);
});

test('redirects and 429/5xx responses are errors and are never retried', async () => {
    for (const status of [302, 429, 500, 503]) {
        const { client, calls } = mockClient(() => json({ error: { message: 'service original', code: 'service_code', type: 'service_type' }, requestId: 'request-original' }, {
            status, headers: { location: 'https://evil.example/', 'retry-after': '17' },
        }));
        await assert.rejects(() => client.listModels(), (error) => {
            assert.ok(error instanceof APIError);
            assert.equal(error.statusCode, status);
            assert.equal(error.message, 'service original');
            assert.equal(error.code, 'service_code');
            assert.equal(error.type, 'service_type');
            assert.equal(error.requestId, 'request-original');
            assert.equal(error.retryAfter, '17');
            return true;
        });
        assert.equal(calls.length, 1);
    }
});

test('native service errors under HTTP 200 are preserved', async () => {
    const body = { success: false, error: { code: 40000, message: 'Original service message' } };
    const { client } = mockClient(() => json(body, { headers: { 'x-request-id': 'header-id' } }), { locale: 'zh-CN' });
    await assert.rejects(() => client.listModels(), (error) => {
        assert.ok(error instanceof APIError);
        assert.equal(error.message, body.error.message);
        assert.equal(error.requestId, 'header-id');
        assert.deepEqual(error.body, body);
        return true;
    });
});

test('string-valued provider errors remain unchanged on success and failure HTTP statuses', async () => {
    for (const status of [200, 400, 503]) {
        const body = { error: 'exact provider text' };
        const { client } = mockClient(() => json(body, { status }), { locale: 'ja' });
        await assert.rejects(() => client.listModels(), (error) => {
            assert.ok(error instanceof APIError);
            assert.equal(error.statusCode, status);
            assert.equal(error.message, body.error);
            assert.deepEqual(error.body, body);
            return true;
        });
    }
});

test('malformed successful JSON raises a protocol error', async () => {
    for (const body of ['not JSON', '', '{"broken":', '{"a":1} {"b":2}']) {
        const { client } = mockClient(() => new Response(body));
        await assert.rejects(() => client.listModels(), SDKError);
    }
});

test('lossless JSON retains safe numbers and large integer strings', async () => {
    const body = '{"id":1234567890123456789,"count":42,"fraction":0.25,"quoted":"1234567890123456789","negative":-1234567890123456789}';
    const expected = { id: '1234567890123456789', count: 42, fraction: 0.25, quoted: '1234567890123456789', negative: '-1234567890123456789' };
    assert.deepEqual(parseJSON(body), expected);
    const { client } = mockClient(() => new Response(body));
    assert.deepEqual(await client.listModels(), expected);
});

test('locale catalog covers all project public languages and local errors are translated', () => {
    assert.deepEqual(new Set(supportedLocales), new Set(['en', 'de', 'tr', 'it', 'es', 'fr', 'pt-BR', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ru']));
    const messages = new Map();
    for (const locale of supportedLocales) {
        try { new RequestBeam({ apiKey: '', locale }); } catch (error) {
            assert.ok(error instanceof SDKError);
            assert.ok(error.message.length > 5);
            messages.set(locale, error.message);
        }
    }
    assert.equal(messages.size, 12);
    assert.notEqual(messages.get('en'), messages.get('zh-CN'));
    assert.notEqual(messages.get('en'), messages.get('ja'));
});

test('job polling follows all pending states and preserves terminal response', async () => {
    const statuses = ['PENDING', 'CONNECT', 'PROCESSING', 'COMPLETED'];
    const { client, calls } = mockClient((_url, _init, count) => json({ success: true, data: { id: '123', status: statuses[count - 1], outputResult: [{ url: ['https://example.com/file.mp4'] }] } }));
    const body = await client.waitForJob('123', { timeoutMs: 1000, pollIntervalMs: 1 });
    assert.equal(body.data.status, 'COMPLETED');
    assert.equal(calls.length, 4);
});

test('failed, cancelled and malformed jobs stop polling immediately', async () => {
    for (const status of ['FAILED', 'CANCELLED']) {
        const { client, calls } = mockClient(() => json({ data: { id: '123', status } }));
        await assert.rejects(() => client.waitForJob('123', { timeoutMs: 1000, pollIntervalMs: 1 }), (error) => {
            assert.ok(error instanceof JobFailedError);
            assert.equal(error.job.status, status);
            return true;
        });
        assert.equal(calls.length, 1);
    }
    for (const body of [{ data: { status: 'UNKNOWN' } }, { data: null }, {}]) {
        const { client, calls } = mockClient(() => json(body));
        await assert.rejects(() => client.waitForJob('123', { timeoutMs: 1000, pollIntervalMs: 1 }), SDKError);
        assert.equal(calls.length, 1);
    }
});

test('job polling deadline is finite and exposes jobId', async () => {
    const { client, calls } = mockClient(() => json({ data: { status: 'PROCESSING' } }));
    await assert.rejects(() => client.waitForJob('123', { timeoutMs: 25, pollIntervalMs: 500 }), (error) => {
        assert.ok(error instanceof PollingTimeoutError);
        assert.equal(error.jobId, '123');
        return true;
    });
    assert.equal(calls.length, 1);
});

test('invalid polling and pagination bounds fail before network access', async () => {
    const { client, calls } = mockClient();
    for (const timeoutMs of [0, -1, NaN, Infinity]) {
        await assert.rejects(() => client.waitForJob('123', { timeoutMs }), SDKError);
    }
    for (const pollIntervalMs of [0, -1, NaN, Infinity]) {
        await assert.rejects(() => client.waitForJob('123', { pollIntervalMs }), SDKError);
    }
    for (const maxPages of [undefined, 0, -1, 0.5, NaN, Infinity, true]) {
        await assert.rejects(() => collect(client.twitterUserTweetPages('123', {}, { maxPages })), SDKError);
    }
    assert.equal(calls.length, 0);
});

test('Twitter pagination is lazy, bounded and does not mutate input', async () => {
    const { client, calls } = mockClient((_url, _init, count) => json({ data: [{ id: String(count) }], meta: { next_token: `cursor-${count}` } }));
    const query = Object.freeze({ max_results: 5 });
    const pages = client.twitterUserTweetPages('123', query, { maxPages: 2 });
    assert.equal(calls.length, 0);
    const results = await collect(pages);
    assert.equal(results.length, 2);
    assert.equal(calls.length, 2);
    assert.equal(new URL(calls[1].url).searchParams.get('pagination_token'), 'cursor-1');
    assert.deepEqual(query, { max_results: 5 });
});

test('Twitter pagination stops at missing token and rejects repeated or nonstring cursors', async () => {
    const { client, calls } = mockClient(() => json({ data: [], meta: {} }));
    assert.equal((await collect(client.twitterUserTweetPages('123', {}, { maxPages: 10 }))).length, 1);
    assert.equal(calls.length, 1);
    for (const token of ['same', 42, {}]) {
        const mocked = mockClient(() => json({ data: [], meta: { next_token: token } }));
        await assert.rejects(() => collect(mocked.client.twitterUserTweetPages('123', { pagination_token: 'same' }, { maxPages: 10 })), SDKError);
        assert.equal(mocked.calls.length, 1);
    }
});

test('Twitter page cap stops before validating unused continuation metadata', async () => {
    for (const meta of [{ next_token: 'same' }, { next_token: 42 }, { next_token: {} }, null, 'invalid-unused-meta']) {
        const body = { data: [{ id: '123' }], meta };
        const { client, calls } = mockClient(() => json(body));
        const pages = await collect(client.twitterUserTweetPages('123', { pagination_token: 'same' }, { maxPages: 1 }));
        assert.deepEqual(pages, [body]);
        assert.equal(calls.length, 1);
    }
});

test('caller abort stops job waiting and page iteration without another request', async () => {
    const controller = new AbortController();
    const mocked = mockClient(() => {
        controller.abort();
        return json({ data: { status: 'PENDING' } });
    });
    await assert.rejects(() => mocked.client.waitForJob('123', { timeoutMs: 1000, pollIntervalMs: 500, signal: controller.signal }));
    assert.equal(mocked.calls.length, 1);
    const pageController = new AbortController();
    const pages = mockClient(() => json({ data: [], meta: { next_token: 'next' } }));
    const iterator = pages.client.twitterUserTweetPages('123', {}, { maxPages: 5, signal: pageController.signal });
    await iterator.next();
    pageController.abort();
    await assert.rejects(() => iterator.next());
    assert.equal(pages.calls.length, 1);
});

test('network errors are not retried and do not expose transport secrets', async () => {
    const { client, calls } = mockClient(() => { throw new Error(`transport diagnostic: ${key}`); });
    await assert.rejects(() => client.listModels(), (error) => {
        assert.ok(error instanceof SDKError);
        assert.ok(!String(error).includes(key));
        assert.ok(!JSON.stringify(error).includes(key));
        assert.ok(!String(error.cause).includes(key));
        return true;
    });
    assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(client).includes(key));
});

test('aborted request does not call fetch', async () => {
    const { client, calls } = mockClient();
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => client.listModels({ signal: controller.signal }), SDKError);
    assert.equal(calls.length, 0);
});

test('request timeout applies when injected fetch never resolves', { timeout: 1500 }, async () => {
    const { client, calls } = mockClient(() => new Promise(() => {}));
    await assert.rejects(() => client.listModels({ timeoutMs: 25 }), SDKError);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.signal.aborted, true);
});

test('URLSearchParams duplicates and reserved characters survive request encoding', async () => {
    const { client, calls } = mockClient();
    const query = new URLSearchParams([['key', 'first'], ['key', 'second'], ['value', 'a/b?c#d+e & f']]);
    await client.request('GET', '/v1/models', { query });
    const result = new URL(calls[0].url).searchParams;
    assert.deepEqual(result.getAll('key'), ['first', 'second']);
    assert.equal(result.get('value'), 'a/b?c#d+e & f');
    assert.deepEqual([...query], [...result]);
});

test('nonserializable payloads fail before a paid request', async () => {
    const { client, calls } = mockClient();
    const circular = {};
    circular.self = circular;
    for (const body of [circular, { value: 1n }]) {
        await assert.rejects(() => client.chatCompletions(body), SDKError);
    }
    assert.equal(calls.length, 0);
});
