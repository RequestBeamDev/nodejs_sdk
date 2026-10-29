import { parse } from 'lossless-json';
import translations from './messages.json';

export type JSONObject = Record<string, unknown>;
export type QueryValue = string | number | boolean;
export type Query = URLSearchParams | Record<string, QueryValue | readonly QueryValue[] | null | undefined>;
export interface RequestOptions { signal?: AbortSignal; timeoutMs?: number; }
export interface ClientOptions {
    timeoutMs?: number;
    apiKey?: string;
    baseURL?: string;
    locale?: string;
    fetch?: typeof fetch;
}
export interface JSONRequestOptions extends RequestOptions { body?: unknown; query?: Query; }
export interface WaitOptions { signal?: AbortSignal; timeoutMs?: number; requestTimeoutMs?: number; pollIntervalMs?: number; }
export interface PageOptions extends RequestOptions { maxPages: number; }
export interface SSEEvent { event: string; data: string; id: string; json(): JSONObject; }
export const supportedLocales = Object.freeze(['en', 'de', 'tr', 'it', 'es', 'fr', 'pt-BR', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ru']);
export const similarwebOperations = Object.freeze([
    'keywords/suggestions', 'keywords/websites', 'websites/backlinks', 'websites/keywords',
    'websites/traffic-sources', 'websites/outgoing-traffic', 'websites/incoming-referrals',
    'websites/branded-keywords', 'websites/geography', 'websites/devices', 'websites/search-performance',
    'websites/social-traffic', 'websites/engagement', 'websites/visits', 'websites/visits/table',
    'websites/visits/trend', 'websites/ranks', 'websites/ranks/country', 'websites/ranks/global',
    'websites/ranks/category', 'websites/channels', 'websites/similar-sites',
    'websites/similar-sites/suggestions', 'websites/history/visits', 'websites/history/bounce-rate',
    'websites/history/visit-duration', 'websites/history/pages-per-visit',
].sort());
const catalog: Record<string, Record<string, string>> = translations;
const MAX_EVENT_BYTES = 64 * 1024 * 1024;
const MAX_TIMER_MS = 2 ** 31 - 1;

export function normalizeLocale(value = 'en'): string {
    const normalized = value.trim().toLowerCase().replaceAll('_', '-');
    const aliases: Record<string, string> = { cn: 'zh-CN', zh: 'zh-CN', 'zh-hans': 'zh-CN', tw: 'zh-TW', 'zh-hant': 'zh-TW', pt: 'pt-BR' };
    return Object.hasOwn(aliases, normalized) ? aliases[normalized] : supportedLocales.find(code => code.toLowerCase() === normalized) ?? 'en';
}
function message(locale: string, code: string): string { return catalog[locale]?.[code] ?? catalog.en[code] ?? code; }
function object(value: unknown): value is JSONObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** Unsafe integral numbers and numeric overflow remain their exact wire strings. */
export function parseJSON(text: string): JSONObject {
    const result = parse(text, undefined, { parseNumber(value) {
        const number = Number(value);
        return !Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number)) ? value : number;
    } });
    if (!object(result)) throw new SyntaxError('Expected a JSON object.');
    return result;
}

export class SDKError extends Error {
    constructor(public readonly code: string, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'SDKError';
    }
}
export class APIError extends Error {
    readonly statusCode: number;
    readonly code: unknown;
    readonly type: string;
    readonly requestId: string;
    readonly retryAfter: string;
    constructor(response: Response, public readonly body: unknown, fallback: string) {
        const root = object(body) ? body : {};
        const nested = object(root.response) ? root.response : {};
        const fields = object(root.error) ? root.error : object(nested.error) ? nested.error : root;
        const errorMessage = typeof root.error === 'string' ? root.error : typeof nested.error === 'string' ? nested.error : undefined;
        super(typeof fields.message === 'string' && fields.message ? fields.message : errorMessage || fallback);
        this.name = 'APIError';
        this.statusCode = response.status;
        this.code = fields.code;
        this.type = typeof fields.type === 'string' ? fields.type : '';
        this.requestId = typeof root.requestId === 'string' ? root.requestId : typeof root.request_id === 'string' ? root.request_id : response.headers.get('x-request-id') ?? '';
        this.retryAfter = response.headers.get('retry-after') ?? '';
    }
}
export class JobFailedError extends SDKError {
    constructor(public readonly job: JSONObject, locale = 'en') { super('job_failed', message(locale, 'job_failed')); this.name = 'JobFailedError'; }
}
export class PollingTimeoutError extends SDKError {
    constructor(public readonly jobId: string, locale = 'en') { super('poll_timeout', message(locale, 'poll_timeout')); this.name = 'PollingTimeoutError'; }
}
function errorBody(body: JSONObject): boolean {
    return body.success === false || (body.error !== undefined && body.error !== null) || body.type === 'error' || body.type === 'response.error';
}
function queryParams(query?: Query): URLSearchParams {
    if (query instanceof URLSearchParams) return new URLSearchParams(query);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null) continue;
        for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
    }
    return params;
}

// Race every I/O operation so injected fetch implementations cannot defeat cancellation.
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) { void promise.catch(() => {}); return Promise.reject(signal.reason); }
    return new Promise<T>((resolve, reject) => {
        const abort = () => { cleanup(); reject(signal.reason); };
        const cleanup = () => signal.removeEventListener('abort', abort);
        signal.addEventListener('abort', abort, { once: true });
        promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
}
function deadline(ms: number, parent?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException('The operation was aborted.', 'AbortError'));
    if (parent?.aborted) abort();
    else parent?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
    return { signal: controller.signal, close() { clearTimeout(timer); parent?.removeEventListener('abort', abort); controller.abort(); } };
}
function safeCause(error: unknown): Error | undefined {
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return new DOMException(error.name === 'AbortError' ? 'The operation was aborted.' : 'The operation timed out.', error.name);
    return undefined;
}

export class RequestBeam {
    readonly locale: string;
    readonly baseURL: string;
    readonly timeoutMs: number;
    #apiKey: string;
    #fetch: typeof fetch;
    constructor(options: ClientOptions = {}) {
        this.locale = normalizeLocale(options.locale);
        const apiKey = options.apiKey ?? process.env.REQUESTBEAM_API_KEY;
        if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey)) throw this.local('missing_api_key');
        this.#apiKey = apiKey;
        const rawURL = options.baseURL ?? 'https://api.requestbeam.com';
        let url: URL;
        try { url = new URL(rawURL); } catch { throw this.local('invalid_base_url'); }
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/' || /[?#\\\s]/.test(rawURL) || !/^https:\/\/[^/]+\/?$/i.test(rawURL)) throw this.local('invalid_base_url');
        this.baseURL = url.origin;
        this.timeoutMs = this.duration(options.timeoutMs ?? 60_000, 'invalid_timeout');
        this.#fetch = options.fetch ?? globalThis.fetch;
    }
    private local(code: string, cause?: unknown): SDKError { return new SDKError(code, message(this.locale, code), { cause: safeCause(cause) }); }
    private duration(value: number, code: string): number {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_TIMER_MS) throw this.local(code);
        return value;
    }
    private identifier(id: string): void { if (typeof id !== 'string' || !/^[0-9]+$/.test(id)) throw this.local('invalid_job_id'); }
    private url(path: string, query?: Query): string {
        if (typeof path !== 'string') throw this.local('invalid_path');
        let decoded = path;
        try { for (let i = 0; i < 4; i++) { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } }
        catch { throw this.local('invalid_path'); }
        if (!decoded.startsWith('/') || /\/\/|[\\?#%\x00-\x20\x7f]/.test(decoded) || decoded.split('/').some(s => s === '.' || s === '..')) throw this.local('invalid_path');
        const url = new URL(path, this.baseURL);
        if (url.origin !== this.baseURL) throw this.local('invalid_path');
        url.search = queryParams(query).toString();
        return url.href;
    }
    private async fetchResponse(method: string, path: string, options: JSONRequestOptions, signal: AbortSignal, stream = false): Promise<Response> {
        const url = this.url(path, options.query);
        let body: string | undefined;
        try { if (options.body !== undefined) body = JSON.stringify(options.body); } catch { throw this.local('invalid_response'); }
        const headers: Record<string, string> = { Authorization: `Bearer ${this.#apiKey}`, Accept: stream ? 'text/event-stream' : 'application/json', 'User-Agent': 'requestbeam-node/0.1.0' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (signal.aborted) throw this.local('transport_error', signal.reason);
        try {
            const promise = this.#fetch(url, { method, headers, body, signal, redirect: 'error', credentials: 'omit' });
            void promise.then(response => { if (signal.aborted) void response.body?.cancel().catch(() => {}); }, () => {});
            return await abortable(promise, signal);
        } catch (error) { throw this.local('transport_error', signal.aborted ? signal.reason : error); }
    }
    private async responseBody(response: Response, signal: AbortSignal): Promise<JSONObject> {
        let text = '';
        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        try {
            if (reader) while (true) {
                let chunk: ReadableStreamReadResult<Uint8Array>;
                try { chunk = await abortable(reader.read(), signal); }
                catch (error) { throw this.local('transport_error', signal.aborted ? signal.reason : error); }
                try { text += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true }); }
                catch { throw this.local('invalid_response'); }
                if (chunk.done) break;
            }
        } finally {
            if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
        }
        let body: JSONObject | undefined;
        try { body = parseJSON(text); } catch { /* HTTP failures still retain their original body. */ }
        if (!response.ok) throw new APIError(response, body ?? text, message(this.locale, 'invalid_response'));
        if (!body) throw this.local('invalid_response');
        if (errorBody(body)) throw new APIError(response, body, message(this.locale, 'invalid_response'));
        return body;
    }
    async request(method: string, path: string, options: JSONRequestOptions = {}): Promise<JSONObject> {
        const scope = deadline(this.duration(options.timeoutMs ?? this.timeoutMs, 'invalid_timeout'), options.signal);
        try { const response = await this.fetchResponse(method, path, options, scope.signal); return await this.responseBody(response, scope.signal); }
        finally { scope.close(); }
    }
    private nonStream(path: string, payload: JSONObject, options: RequestOptions): Promise<JSONObject> {
        if (payload.stream !== undefined && payload.stream !== null && payload.stream !== false) return Promise.reject(this.local('invalid_stream'));
        return this.request('POST', path, { ...options, body: payload });
    }
    listModels(options: RequestOptions = {}) { return this.request('GET', '/v1/models', options); }
    chatCompletions(payload: JSONObject, options: RequestOptions = {}) { return this.nonStream('/v1/chat-completions', payload, options); }
    responses(payload: JSONObject, options: RequestOptions = {}) { return this.nonStream('/openai/responses', payload, options); }
    messages(payload: JSONObject, options: RequestOptions = {}) { return this.nonStream('/anthropic/v1/messages', payload, options); }
    generateImage(payload: JSONObject, options: RequestOptions = {}) { return this.nonStream('/openai/v1/images/generations', payload, options); }
    generateVideo(payload: JSONObject, options: RequestOptions = {}) { return this.request('POST', '/v1/video/seedance', { ...options, body: payload }); }
    getJob(id: string, options: RequestOptions = {}) { this.identifier(id); return this.request('GET', `/v1/jobs/${id}`, options); }
    async waitForJob(id: string, options: WaitOptions = {}): Promise<JSONObject> {
        this.identifier(id);
        const timeout = this.duration(options.timeoutMs ?? 600_000, 'invalid_timeout');
        const interval = this.duration(options.pollIntervalMs ?? 2_000, 'invalid_poll_interval');
        const requestTimeout = this.duration(options.requestTimeoutMs ?? this.timeoutMs, 'invalid_timeout');
        const scope = deadline(timeout, options.signal);
        try {
            while (true) {
                const body = await this.getJob(id, { signal: scope.signal, timeoutMs: requestTimeout });
                const job = body.data;
                if (!object(job)) throw this.local('invalid_response');
                if (job.status === 'COMPLETED') return body;
                if (job.status === 'FAILED' || job.status === 'CANCELLED') throw new JobFailedError(job, this.locale);
                if (!['PENDING', 'CONNECT', 'PROCESSING'].includes(job.status as string)) throw this.local('invalid_response');
                let timer: ReturnType<typeof setTimeout> | undefined;
                try { await abortable(new Promise<void>(resolve => { timer = setTimeout(resolve, interval); }), scope.signal); }
                finally { clearTimeout(timer); }
            }
        } catch (error) {
            if (options.signal?.aborted) throw this.local('transport_error', new DOMException('Aborted', 'AbortError'));
            if (scope.signal.aborted) throw new PollingTimeoutError(id, this.locale);
            throw error;
        } finally { scope.close(); }
    }
    similarweb(operation: string, query?: Query, options: RequestOptions = {}) {
        operation = operation.replace(/^\/v1\/similarweb\//, '');
        if (!similarwebOperations.includes(operation)) throw this.local('invalid_path');
        return this.request('GET', `/v1/similarweb/${operation}`, { ...options, query });
    }
    twitterUserByUsername(username: string, query?: Query, options: RequestOptions = {}) {
        const params = queryParams(query); params.set('username', username);
        return this.request('GET', '/v1/twitter/users', { ...options, query: params });
    }
    twitterUser(id: string, query?: Query, options: RequestOptions = {}) {
        this.identifier(id); return this.request('GET', `/v1/twitter/users/${id}`, { ...options, query });
    }
    twitterUserTweets(id: string, query?: Query, options: RequestOptions = {}) {
        this.identifier(id); return this.request('GET', `/v1/twitter/users/${id}/tweets`, { ...options, query });
    }
    async *twitterUserTweetPages(id: string, query: Query | undefined, options: PageOptions): AsyncGenerator<JSONObject> {
        this.identifier(id);
        if (!options || !Number.isSafeInteger(options.maxPages) || options.maxPages < 1) throw this.local('invalid_pagination');
        const params = queryParams(query);
        const seen = new Set<string>();
        const initial = params.get('pagination_token'); if (initial) seen.add(initial);
        for (let page = 0; page < options.maxPages; page++) {
            const body = await this.twitterUserTweets(id, params, options);
            yield body;
            if (page + 1 >= options.maxPages) return;
            if (body.meta === undefined) return;
            if (!object(body.meta)) throw this.local('invalid_response');
            const token = body.meta.next_token;
            if (token === undefined || token === null || token === '') return;
            if (typeof token !== 'string' || seen.has(token)) throw this.local('invalid_pagination');
            seen.add(token); params.set('pagination_token', token);
        }
    }
    streamChatCompletions(payload: JSONObject, options: RequestOptions = {}) { return this.stream('/v1/chat-completions', 'chat', payload, options); }
    streamResponses(payload: JSONObject, options: RequestOptions = {}) { return this.stream('/openai/responses', 'responses', payload, options); }
    streamMessages(payload: JSONObject, options: RequestOptions = {}) { return this.stream('/anthropic/v1/messages', 'messages', payload, options); }
    streamImage(payload: JSONObject, options: RequestOptions = {}) { return this.stream('/openai/v1/images/generations', 'image', payload, options); }
    private async *stream(path: string, kind: string, payload: JSONObject, options: RequestOptions): AsyncGenerator<SSEEvent> {
        const scope = deadline(this.duration(options.timeoutMs ?? this.timeoutMs, 'invalid_timeout'), options.signal);
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
            const response = await this.fetchResponse('POST', path, { body: { ...payload, stream: true } }, scope.signal, true);
            if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
                await this.responseBody(response, scope.signal); throw this.local('invalid_response');
            }
            if (!response.body) throw this.local('invalid_response');
            reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8', { fatal: true });
            let buffer = '', event = '', id = '', data: string[] = [], dataSize = 0, first = true, imageCompleted = false;
            while (true) {
                let chunk: ReadableStreamReadResult<Uint8Array>;
                try { chunk = await abortable(reader.read(), scope.signal); }
                catch (error) { throw this.local('transport_error', scope.signal.aborted ? scope.signal.reason : error); }
                try { buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true }); }
                catch { throw this.local('invalid_response'); }
                if (Buffer.byteLength(buffer) > MAX_EVENT_BYTES) throw this.local('stream_error');
                while (true) {
                    const index = buffer.search(/[\r\n]/);
                    if (index < 0 || (!chunk.done && buffer[index] === '\r' && index === buffer.length - 1)) break;
                    let line = buffer.slice(0, index);
                    buffer = buffer.slice(index + (buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1));
                    if (first) { line = line.replace(/^\uFEFF/, ''); first = false; }
                    if (line === '') {
                        if (data.length) {
                            const raw = data.join('\n');
                            const name = event || 'message';
                            if (raw === '[DONE]') {
                                if (name === 'error' || name === 'response.error' || !['chat', 'image'].includes(kind) || (kind === 'image' && !imageCompleted)) throw this.local('stream_error');
                                return;
                            }
                            let body: JSONObject;
                            try { body = parseJSON(raw); } catch { throw this.local('invalid_response'); }
                            if (name === 'error' || name === 'response.error' || errorBody(body) || body.type === 'response.failed' || name === 'response.failed') throw new APIError(response, body, message(this.locale, 'stream_error'));
                            const type = typeof body.type === 'string' && body.type ? body.type : name;
                            if (kind === 'image' && type === 'image_generation.completed') imageCompleted = true;
                            yield { event: name, data: raw, id, json: () => parseJSON(raw) };
                            if (scope.signal.aborted) throw this.local('transport_error', scope.signal.reason);
                            if ((kind === 'responses' && ['response.completed', 'response.incomplete'].includes(type)) || (kind === 'messages' && type === 'message_stop')) return;
                        }
                        event = ''; data = []; dataSize = 0;
                    } else if (!line.startsWith(':')) {
                        const colon = line.indexOf(':');
                        const field = colon === -1 ? line : line.slice(0, colon);
                        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
                        if (field === 'data') { dataSize += Buffer.byteLength(value) + 1; if (dataSize > MAX_EVENT_BYTES) throw this.local('stream_error'); data.push(value); }
                        else if (field === 'event') event = value;
                        else if (field === 'id' && !value.includes('\0')) id = value;
                    }
                }
                if (chunk.done) throw this.local('stream_error');
            }
        } finally {
            scope.close();
            if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
        }
    }
}
