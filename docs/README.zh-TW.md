# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

適用於 RequestBeam 文字、圖片、影片、Similarweb 與 Twitter API 的 Node.js / TypeScript 用戶端。支援取消請求、SSE 串流、有上限的輪詢與分頁，以及專案全部 12 種語言的 SDK 提示。

## 安裝與開始

需要 Node.js 20 或更新版本。直接從此 Git 儲存庫安裝，不假設已發佈至 npm 登錄庫。為確保可重現建置，請在 Git URL 中固定提交（`#<commit>`）並保留鎖定檔。透過 `client.listModels()` 選擇目標端點與帳戶支援的模型；模型列在目錄中不代表供應商目前可用。將範例存為 `.mjs` 檔案，或在應用程式中使用 ESM。

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'zh-TW' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## 語言與設定

`locale` 只改變 SDK 自有提示，不翻譯 API 欄位、提示詞、模型 ID、伺服器錯誤或回傳內容。`supportedLocales` 匯出下列語言。`pt`、`cn`、`zh`、`tw` 等別名、大小寫及底線會正規化；未知語言回退為英文。JSON 保留原生回應結構。不安全的整數及數值溢位會保留為字串，安全值仍為 JavaScript 數值。ID 請傳入字串。

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

預設 `baseURL` 為 `https://api.requestbeam.com`，不含 `/v1`。自訂來源必須使用 HTTPS，不能包含路徑、憑證、查詢或片段。SDK 拒絕重新導向。預設 `timeoutMs: 60000` 涵蓋整個請求與串流；長時間生成可設為 `600000`。所有網路方法接受可選的 `{ signal, timeoutMs }`，較早發生的中止優先。注入的 `fetch` 是呼叫端信任的程式碼。API Key 只保存在伺服器或環境變數中，不要放入瀏覽器程式碼或 Git。

## 串流回應與工作

`streamChatCompletions`、`streamResponses`、`streamMessages` 與 `streamImage` 回傳非同步迭代器，事件包含 `event`、`data`、`id` 及 `json()`。並非每個事件都有文字。`[DONE]` 在內部處理；退出迴圈或發出中止訊號會停止讀取。串流錯誤及提前結束會拋出錯誤。單一事件上限為 64 MiB。`response.incomplete` 會結束串流，但結果並不完整，請檢查狀態與 `incomplete_details`。

圖片直接回傳 JSON 或 SSE，不使用影片 Jobs。`generateVideo` 回傳 `data.jobId`。`waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` 在 `COMPLETED` 時回傳完整 Jobs 回應；`FAILED` 與 `CANCELLED` 拋出 `JobFailedError`，等待逾時拋出 `PollingTimeoutError`。本機取消或逾時不會停止遠端工作或計費。非串流方法拒絕 `stream: true`。

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb 與 Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` 支援 27 個公開操作並保留原生欄位。僅提供全球資料（`country=999`）；其他獲接受的國家值也回傳全球資料。需要時同時傳入 `from` 和 `to`，SDK 不改寫日期。空結果不代表流量為零。Twitter 方法涵蓋使用者名稱、使用者 ID 及時間軸。`twitterUserTweetPages(id, query, { maxPages: 3 })` 依 `meta.next_token` 回傳完整頁面，拒絕重複游標，在明確上限停止，不保證取得完整時間軸。每一頁都可能單獨計費。

## 錯誤與驗證

`APIError` 保留 `statusCode`、伺服器 `code`/`type`、`requestId`、`retryAfter` 與原始 `body`。`SDKError` 標示本機、協定及傳輸錯誤。SDK 不自動重試，包括 GET。網路錯誤不代表伺服器未處理或未計費。SDK 不自動下載結果檔案，請使用獨立且不帶認證的用戶端下載可信 URL。不要記錄私密請求、回應或 API Key。測試使用模擬回應；範例發送真實請求，可能產生費用。

在此儲存庫的複製目錄中執行以下命令。本機測試及 CI 不證明實際供應商可用性，也不代表正式環境部署。

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## 範例與參考

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/tw) | [API docs](https://requestbeam.com/tw/docs/api-reference/models)
