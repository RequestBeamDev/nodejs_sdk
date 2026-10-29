# Design and validation boundaries

The SDK targets server-side Node.js 20 or newer. It uses native `fetch`, TypeScript declarations, and `lossless-json` for response parsing. CommonJS and ESM applications can import the same build. The package is installed from Git; this repository does not claim an npm release.

Public contracts were inspected on 2026-10-29. Source-of-truth files in the Synapse repository:

- `wiki/public-api-catalog.json`
- `wiki/en/api-reference/jobs.mdx`
- `wiki/en/api-reference/errors.mdx`
- `wiki/en/api-reference/OpenAI/gpt-image-2.mdx`
- `wiki/en/api-reference/similarweb/overview.mdx`
- `wiki/en/api-reference/twitter/get-user-tweets.mdx`
- `packages/shared/src/public-api/public-locales.json`

The companion RequestBeam Python and Go SDKs provide behavior and translation references. This repository contains public SDK code and documentation, not server source, credentials, or deployment configuration.

## Decisions

- Native JSON envelopes and unknown fields are preserved. Unsafe integral values and numeric overflow are represented as decimal strings; safe numbers remain numbers. IDs are always supplied as strings. Decimal fractions otherwise use JavaScript number semantics.
- All network methods accept `AbortSignal`; timeouts cover the entire body and stream. Stopping local work does not cancel remote generation or its charges.
- The SDK makes no automatic application-level retries, including data GET requests. Pagination and polling are explicit and bounded. An injected `fetch` implementation is trusted caller-owned code and controls its own internal behavior.
- HTTPS origins are trust boundaries. API redirects are blocked. File URLs are not downloaded automatically; use a separate unauthenticated client for trusted files.
- Image responses arrive directly as JSON or SSE. Video generation uses Jobs. Stream termination is validated for each protocol.
- Locale selection changes SDK-owned messages only. API keys, protocol fields, model IDs, prompts, server errors, and generated content are never translated.
- Tests use local mocks. Passing tests, publishing commits, and CI results do not establish model availability, paid API success, production deployment, or an npm release.

## Maintenance

Compare `supportedLocales` against the Synapse registry when adding a language. Keep all twelve guides aligned. Add route, error, cancellation, and streaming tests when public contracts change. Avoid introducing implicit retries or unbounded pagination because requests may be billed independently.
