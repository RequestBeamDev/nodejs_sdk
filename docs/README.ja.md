# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

RequestBeam のテキスト、画像、動画、Similarweb、Twitter API 用 Node.js / TypeScript クライアントです。キャンセル可能なリクエスト、SSE、上限付きポーリングとページ取得、プロジェクトの全 12 言語の SDK メッセージに対応します。

## インストールと開始

Node.js 20 以降が必要です。この Git リポジトリから直接インストールします。npm レジストリでの公開は前提としていません。再現可能なビルドには Git URL のコミットを固定し（`#<commit>`）、ロックファイルを保持してください。`client.listModels()` でエンドポイントとアカウントに対応するモデルを選びます。カタログへの掲載はプロバイダーの稼働を保証しません。例を `.mjs` として保存するか、アプリで ESM を使用してください。

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'ja' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## 言語と設定

`locale` が変更するのは SDK 自身のメッセージのみです。API フィールド、プロンプト、モデル ID、サーバーエラー、結果の内容は変更しません。`supportedLocales` は以下の言語を公開します。`pt`、`cn`、`zh`、`tw` などの別名、大文字、アンダースコアは正規化され、不明な言語は英語になります。JSON 応答は元の構造を保持します。安全に表現できない整数と数値オーバーフローは文字列になり、安全な値は JavaScript の数値のままです。ID は文字列で指定してください。

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

既定の `baseURL` は `/v1` を含まない `https://api.requestbeam.com` です。独自のオリジンは HTTPS を使用し、パス、認証情報、クエリ、フラグメントを含められません。リダイレクトは拒否します。既定の `timeoutMs: 60000` はリクエストとストリーム全体に適用されます。長い生成には `600000` などを指定してください。すべてのネットワークメソッドは任意の `{ signal, timeoutMs }` を受け取り、先に発生した中止が優先されます。独自の `fetch` は呼び出し側が信頼するコードです。キーはサーバーまたは環境変数に保管し、ブラウザーコードや Git に入れないでください。

## ストリーミングとジョブ

`streamChatCompletions`、`streamResponses`、`streamMessages`、`streamImage` は `event`、`data`、`id`、`json()` を持つ非同期イテレーターを返します。すべてのイベントにテキストがあるわけではありません。`[DONE]` は内部で処理され、ループを抜けるか中止すると読み取りを終了します。エラーや途中終了は失敗として扱います。イベントの上限は 64 MiB です。`response.incomplete` は終了イベントですが結果は未完了です。ステータスと `incomplete_details` を確認してください。

画像は動画 Jobs を使わず JSON または SSE を直接返します。`generateVideo` は `data.jobId` を返します。`waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` は `COMPLETED` で Jobs 応答全体を返し、`FAILED` と `CANCELLED` で `JobFailedError` を送出します。期限切れは `PollingTimeoutError` です。ローカルの中止や期限切れはリモートジョブや課金を停止しません。非ストリーミングメソッドは `stream: true` を拒否します。

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb と Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` は 27 の公開操作と元のフィールドに対応します。世界全体のデータのみです（`country=999`）。受理される他の国コードも世界全体のデータを返します。必要な場合は `from` と `to` を一緒に渡してください。日付は書き換えません。空の結果はアクセス数ゼロの証拠ではありません。Twitter メソッドはユーザー名、ID、タイムラインに対応します。`twitterUserTweetPages(id, query, { maxPages: 3 })` は `meta.next_token` でページ全体を返し、重複カーソルを拒否して指定上限で停止します。タイムライン全体の取得は保証しません。ページごとに課金される場合があります。

## エラーと検証

`APIError` は `statusCode`、サービスの `code`/`type`、`requestId`、`retryAfter`、元の `body` を保持します。`SDKError` はローカル、プロトコル、通信の失敗を表します。SDK は GET を含め自動再試行しません。通信エラーでもサーバーが処理または課金した可能性があります。ファイルは自動ダウンロードしません。信頼できる URL に対して別の認証なしクライアントを使ってください。非公開の本文やキーをログに記録しないでください。テストはモックを使いますが、実行例は実際のリクエストを送り、課金される場合があります。

以下のコマンドはリポジトリのクローン内で実行します。ローカルテストや CI の成功は、プロバイダーの実際の稼働や本番デプロイを証明しません。

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## 実行例とリファレンス

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/ja) | [API docs](https://requestbeam.com/ja/docs/api-reference/models)
