# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

面向 RequestBeam 文本、图片、视频、Similarweb 和 Twitter API 的 Node.js / TypeScript 客户端。支持取消请求、SSE 流、有限轮询与分页，以及项目全部 12 种语言的 SDK 提示。

## 安装与开始

需要 Node.js 20 或以上版本。直接从此 Git 仓库安装，不假定已发布到 npm 仓库。为了可重复构建，请在 Git URL 中固定提交（`#<commit>`）并保留锁文件。通过 `client.listModels()` 选择目标接口和账户支持的模型；模型出现在目录中不代表供应商当前可用。将示例存为 `.mjs` 文件，或在应用中使用 ESM。

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'zh-CN' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## 语言与配置

`locale` 只改变 SDK 自有提示，不翻译 API 字段、提示词、模型 ID、服务端错误或返回内容。`supportedLocales` 导出下列语言。`pt`、`cn`、`zh`、`tw` 等别名、大小写和下划线会归一化；未知语言回退到英文。JSON 保留原生响应结构。不安全的整数和数值溢出会保留为字符串，安全值仍为 JavaScript 数值。ID 请传字符串。

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

默认 `baseURL` 为 `https://api.requestbeam.com`，不带 `/v1`。自定义源地址必须使用 HTTPS，不能包含路径、凭证、查询或片段。SDK 拒绝重定向。默认 `timeoutMs: 60000` 覆盖整个请求和流；长时间生成可设为 `600000`。所有网络方法接受可选的 `{ signal, timeoutMs }`，更早发生的中止优先。注入的 `fetch` 属于调用方信任的代码。API Key 只保存在服务端或环境变量中，不要放入浏览器代码或 Git。

## 流式响应与任务

`streamChatCompletions`、`streamResponses`、`streamMessages` 和 `streamImage` 返回异步迭代器，事件包含 `event`、`data`、`id` 和 `json()`。不是每个事件都有文本。`[DONE]` 在内部处理；退出循环或发送中止信号会停止读取。流错误和提前结束会抛错。单个事件限制为 64 MiB。`response.incomplete` 会结束流，但结果不完整，请检查状态和 `incomplete_details`。

图片直接返回 JSON 或 SSE，不使用视频 Jobs。`generateVideo` 返回 `data.jobId`。`waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` 在 `COMPLETED` 时返回完整 Jobs 响应；`FAILED` 和 `CANCELLED` 抛出 `JobFailedError`，等待到期抛出 `PollingTimeoutError`。本地取消或超时不会停止远端任务或计费。非流式方法拒绝 `stream: true`。

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb 与 Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` 支持 27 个公开操作并保留原生字段。仅提供全球数据（`country=999`）；其他被接受的国家值也返回全球数据。需要时同时传 `from` 和 `to`，SDK 不改写日期。空结果不代表流量为零。Twitter 方法覆盖用户名、用户 ID 和时间线。`twitterUserTweetPages(id, query, { maxPages: 3 })` 按 `meta.next_token` 返回完整页面，拒绝重复游标，在显式上限停止，不保证获取完整时间线。每一页都可能单独计费。

## 错误与验证

`APIError` 保留 `statusCode`、服务端 `code`/`type`、`requestId`、`retryAfter` 和原始 `body`。`SDKError` 标识本地、协议和传输错误。SDK 不自动重试，包括 GET。网络错误不代表服务端未处理或未计费。SDK 不自动下载结果文件，请使用独立且不携带认证的客户端下载可信 URL。不要记录私密请求、响应或 API Key。测试使用模拟响应；示例发送真实请求，可能产生费用。

在此仓库的克隆目录中执行以下命令。本地测试和 CI 不证明真实供应商可用性，也不代表生产部署。

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## 示例与参考

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/cn) | [API docs](https://requestbeam.com/cn/docs/api-reference/models)
