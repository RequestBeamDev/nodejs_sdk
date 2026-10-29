# RequestBeam Node.js SDK

[English](README.md) | [Deutsch](docs/README.de.md) | [Türkçe](docs/README.tr.md) | [Italiano](docs/README.it.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [Português](docs/README.pt-BR.md) | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [简体中文](docs/README.zh-CN.md) | [繁體中文](docs/README.zh-TW.md) | [Русский](docs/README.ru.md)

A Node.js and TypeScript client for RequestBeam text, image, video, Similarweb, and Twitter APIs. Includes cancellable requests, SSE streams, bounded polling and pagination, and SDK messages in all 12 project languages.

## Install and start

Node.js 20 or newer is required. Install directly from this Git repository; an npm registry release is not assumed. For reproducible builds, pin a commit in the Git URL (`#<commit>`) and retain your lockfile. Choose a model supported by the endpoint and your account using `client.listModels()`; a catalog entry does not guarantee provider availability. Save this example as an `.mjs` file, or use ESM in your application.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'en' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Language and configuration

`locale` changes SDK-owned messages only. API fields, prompts, model IDs, server errors, and returned content remain unchanged. `supportedLocales` exports the languages below. Aliases such as `pt`, `cn`, `zh`, and `tw`, case differences, and underscores are normalized; unknown locales fall back to English. JSON responses retain native envelopes. Unsafe integral numbers and numeric overflow become strings; safe values remain JavaScript numbers. Supply IDs as strings.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

The default `baseURL` is `https://api.requestbeam.com`, without `/v1`. Custom origins must use HTTPS without a path, credentials, query, or fragment. Redirects are blocked. The default `timeoutMs: 60000` covers the whole request and stream; use `600000` for longer generation streams. All network methods accept an optional `{ signal, timeoutMs }`. An earlier abort wins. An injected `fetch` is trusted caller-owned code. Keep API keys on the server or in environment variables, never in browser code or Git.

## Streaming and jobs

`streamChatCompletions`, `streamResponses`, `streamMessages`, and `streamImage` return async iterators of events with `event`, `data`, `id`, and `json()`. Not every event contains text. `[DONE]` is handled internally; breaking the loop or aborting stops reading. Stream errors and premature endings fail. Events are limited to 64 MiB. `response.incomplete` is terminal but incomplete: inspect status and `incomplete_details`.

Images return JSON or SSE directly, without video Jobs. `generateVideo` returns `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` returns the complete Jobs response at `COMPLETED`; `FAILED` and `CANCELLED` throw `JobFailedError`. Expiry throws `PollingTimeoutError`. Local cancellation or expiry does not stop the remote job or billing. Non-streaming helpers reject `stream: true`.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb and Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` supports 27 public operations and native fields. Only worldwide data is available (`country=999`); other accepted country values still yield worldwide data. Pass `from` and `to` together where required; dates are not rewritten. Empty results do not prove zero traffic. Twitter helpers cover usernames, IDs, and timelines. `twitterUserTweetPages(id, query, { maxPages: 3 })` yields complete pages using `meta.next_token`, rejects repeated cursors, and stops at the explicit limit; it does not guarantee a complete timeline. Each page can be charged.

## Errors and verification

`APIError` retains `statusCode`, service `code`/`type`, `requestId`, `retryAfter`, and the original `body`. `SDKError` identifies local, protocol, and transport failures. The SDK does not automatically retry, including GET. A network error does not prove the server did not process or bill a request. Result files are not downloaded automatically; use a separate unauthenticated client for trusted file URLs. Avoid logging private bodies or API keys. Tests use mocks; examples send real requests and may incur charges.

Run these commands from a clone of this repository. Local tests and CI do not prove live provider availability or a production deployment.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Examples and reference

[text.mjs](examples/text.mjs) | [stream.mjs](examples/stream.mjs) | [video.mjs](examples/video.mjs) | [data.mjs](examples/data.mjs)

[API](docs/api-reference.md) | [Design](docs/design.md) | [RequestBeam](https://requestbeam.com/en) | [API docs](https://requestbeam.com/en/docs/api-reference/models)
