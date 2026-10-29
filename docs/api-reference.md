# API reference

For Node.js 20 or newer. All network methods return promises or async iterators and accept cancellation. The SDK has no background workers or automatic retry loop. An injected `fetch` implementation is trusted caller-owned code and controls any retries within that implementation.

## Imports and client

```javascript
import {
    RequestBeam,
    APIError,
    SDKError,
    JobFailedError,
    PollingTimeoutError,
    parseJSON,
    normalizeLocale,
    supportedLocales,
    similarwebOperations,
} from '@requestbeam/nodejs-sdk';
```

CommonJS is also supported:

```javascript
const { RequestBeam } = require('@requestbeam/nodejs-sdk');
```

```typescript
interface ClientOptions {
    apiKey?: string;
    baseURL?: string;
    locale?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
}

const client = new RequestBeam(options);
```

An omitted `apiKey` uses `REQUESTBEAM_API_KEY`. Defaults are `https://api.requestbeam.com`, `en`, and `60000` milliseconds. Custom base URLs must be HTTPS origins with no credentials, path, query, or fragment. Redirects are blocked and cookies are omitted. Use a separate unauthenticated client for downloading trusted result files.

`supportedLocales` and `similarwebOperations` are frozen arrays. `normalizeLocale` accepts case and underscore variations plus `pt`, `cn`, `zh`, `zh-hans`, `tw`, and `zh-hant` aliases. Unknown and empty values fall back to English. Only SDK-owned messages are translated.

## JSON and options

```typescript
type JSONObject = Record<string, unknown>;
type QueryValue = string | number | boolean;
type Query = URLSearchParams | Record<
    string,
    QueryValue | readonly QueryValue[] | null | undefined
>;

interface RequestOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
}
interface JSONRequestOptions extends RequestOptions {
    body?: unknown;
    query?: Query;
}
```

JSON methods return `Promise<JSONObject>`, preserving native response envelopes and unknown fields. Safe numbers remain JavaScript numbers; unsafe integer-valued numbers and numeric overflow remain their original numeric strings. Decimal fractions otherwise follow JavaScript number precision. `parseJSON(text)` applies the same policy and requires a JSON object; it throws for malformed JSON or a non-object root. Use `event.json()` or `parseJSON(event.data)` for SSE data instead of `JSON.parse` when IDs or large numbers must remain exact.

Job and Twitter ID arguments must be nonempty strings of ASCII digits. Already-rounded JavaScript numbers cannot be repaired; do not convert IDs to `number` before sending them. Request bodies use JSON serialization, so pass string IDs rather than `bigint` values. Query arrays become repeated parameters, while `null` and `undefined` entries are omitted. Input payloads and query parameters are not modified.

All durations must be finite, positive, and at most `2147483647` milliseconds, the Node.js timer limit. The request timeout includes reading the entire response or stream. An earlier caller abort takes precedence. A request timeout is distinct from a polling deadline.

## Routes

| Method | HTTP route |
| --- | --- |
| `listModels(options?)` | `GET /v1/models` |
| `chatCompletions(payload, options?)` | `POST /v1/chat-completions` |
| `responses(payload, options?)` | `POST /openai/responses` |
| `messages(payload, options?)` | `POST /anthropic/v1/messages` |
| `generateImage(payload, options?)` | `POST /openai/v1/images/generations` |
| `generateVideo(payload, options?)` | `POST /v1/video/seedance` |
| `getJob(jobId, options?)` | `GET /v1/jobs/{jobId}` |
| `similarweb(operation, query?, options?)` | `GET /v1/similarweb/{operation}` |
| `twitterUserByUsername(username, query?, options?)` | `GET /v1/twitter/users?username=...` |
| `twitterUser(userId, query?, options?)` | `GET /v1/twitter/users/{userId}` |
| `twitterUserTweets(userId, query?, options?)` | `GET /v1/twitter/users/{userId}/tweets` |

`payload` is a `JSONObject`. Text and image JSON helpers reject `stream: true`; use their corresponding stream methods. Model-specific parameters and response fields follow the public endpoint documentation. A model listing is not a live provider availability test.

`request(method, path, options?)` is the generic JSON escape hatch for same-origin API routes. `path` starts with a single `/` and cannot contain traversal, query, fragment, or another host. Supply query parameters through `options.query`. It does not infer model-specific validation or translate server fields.

## Streaming

```typescript
interface SSEEvent {
    event: string;
    data: string;
    id: string;
    json(): JSONObject;
}

client.streamChatCompletions(payload, options?); // AsyncGenerator<SSEEvent>
client.streamResponses(payload, options?);      // AsyncGenerator<SSEEvent>
client.streamMessages(payload, options?);       // AsyncGenerator<SSEEvent>
client.streamImage(payload, options?);          // AsyncGenerator<SSEEvent>
```

These methods force `stream: true` without mutating the payload. Requests start when iteration begins. Events arrive in wire order; event names default to `message`. `data` contains raw SSE data with multiline fields joined by newlines; `json()` parses it with the SDK number policy. SSE comments are ignored. Breaking out of `for await` or passing an aborted signal releases the response body. Local cancellation does not cancel remote generation or billing.

| Protocol | Required normal termination |
| --- | --- |
| Chat Completions | `[DONE]` |
| Responses | `response.completed` or `response.incomplete` |
| Claude Messages | `message_stop` |
| Images | `image_generation.completed`, then `[DONE]` |

Terminal JSON events are yielded; `[DONE]` is consumed internally. `response.incomplete` is a terminal but incomplete result, so inspect the response status and `incomplete_details`. Server error events, malformed JSON, unexpected content types, and premature EOF fail instead of reporting a successful partial result. Event buffering is limited to 64 MiB. The timeout covers the whole stream, including time spent between iterator reads; use a suitable duration for long generations.

## Jobs

```typescript
interface WaitOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    requestTimeoutMs?: number;
    pollIntervalMs?: number;
}

client.waitForJob(jobId, options?); // Promise<JSONObject>
```

Defaults are a 600000 ms overall deadline, 2000 ms polling interval, and the client's configured timeout for each request. `PENDING`, `CONNECT`, and `PROCESSING` continue polling. `COMPLETED` returns the complete response envelope. `FAILED` and `CANCELLED` throw `JobFailedError`; unrecognized status values fail validation. `PollingTimeoutError` means the local overall deadline expired. Cancelling the signal interrupts the HTTP request or delay. The SDK does not cancel the remote job or refund charges.

Images return directly and do not use this video polling workflow. Video creation returns `data.jobId`; keep it as a string.

## Twitter pagination

```typescript
interface PageOptions extends RequestOptions {
    maxPages: number;
}

client.twitterUserTweetPages(userId, query, options); // AsyncGenerator<JSONObject>
```

`maxPages` is required and must be a positive safe integer. Pass `undefined` for an absent query. Each iteration yields the complete native page, follows `meta.next_token` using `pagination_token`, and rejects invalid or repeated cursors. No request for the next page is made until iteration resumes. Breaking the loop stops further page requests. Reaching the explicit limit does not prove a complete timeline. Every data GET/page may be billed separately. `timeoutMs` applies to each page; use a caller `AbortSignal` to bound the complete traversal.

## Similarweb operations

`similarwebOperations` exports these 27 names. The `/v1/similarweb/` prefix is optional in the operation argument.

```text
keywords/suggestions
keywords/websites
websites/backlinks
websites/keywords
websites/traffic-sources
websites/outgoing-traffic
websites/incoming-referrals
websites/branded-keywords
websites/geography
websites/devices
websites/search-performance
websites/social-traffic
websites/engagement
websites/visits
websites/visits/table
websites/visits/trend
websites/ranks
websites/ranks/country
websites/ranks/global
websites/ranks/category
websites/channels
websites/similar-sites
websites/similar-sites/suggestions
websites/history/visits
websites/history/bounce-rate
websites/history/visit-duration
websites/history/pages-per-visit
```

Only worldwide data is supported: `country=999`. Other accepted countries are normalized by the service to worldwide data. The SDK leaves date and pagination parameters unchanged. Follow endpoint-specific query contracts, including `key` versus `keys`; native response fields and capitalization are preserved. There is no generic Similarweb paginator because endpoint response shapes differ. Empty results do not establish zero traffic.

## Errors

Unsuccessful HTTP statuses and successful HTTP responses declaring an application error throw `APIError`. It preserves `statusCode`, service `code` and `type`, `requestId`, `retryAfter`, and original `body`. Server messages are retained. The body can contain private data; inspect it before logging.

Local errors are `SDKError` instances with stable machine `code` and a localized `message`. `JobFailedError` adds `job`; `PollingTimeoutError` adds `jobId`. Cancellation and per-request timeouts are transport errors whose `cause.name` is `AbortError` or `TimeoutError`. Arbitrary transport exceptions are not exposed because they can contain credentials or private request data.

The SDK does not retry API calls automatically, including GET requests. A transport error cannot establish whether the server processed or charged the request. Verify before retrying.

See [design notes](design.md) for maintenance sources and validation boundaries.
