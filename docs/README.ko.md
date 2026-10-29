# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

RequestBeam 텍스트, 이미지, 동영상, Similarweb 및 Twitter API용 Node.js와 TypeScript 클라이언트입니다. 취소 가능한 요청, SSE, 횟수가 제한된 폴링과 페이지 조회, 프로젝트의 12개 언어로 된 SDK 메시지를 제공합니다.

## 설치 및 시작

Node.js 20 이상이 필요합니다. 이 Git 저장소에서 직접 설치하며 npm 레지스트리 게시를 전제로 하지 않습니다. 재현 가능한 빌드를 위해 Git URL에 커밋을 고정하고 (`#<commit>`) 잠금 파일을 유지하세요. `client.listModels()`로 엔드포인트와 계정에 맞는 모델을 선택하세요. 카탈로그 등록이 공급자의 가용성을 보장하지는 않습니다. 예제를 `.mjs`로 저장하거나 ESM을 사용하세요.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'ko' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## 언어 및 설정

`locale`은 SDK 자체 메시지만 변경합니다. API 필드, 프롬프트, 모델 ID, 서버 오류와 결과 내용은 바꾸지 않습니다. `supportedLocales`는 아래 언어를 내보냅니다. `pt`, `cn`, `zh`, `tw` 등의 별칭, 대소문자와 밑줄을 정규화하며 알 수 없는 언어는 영어로 대체합니다. JSON 응답은 원래 구조를 유지합니다. 안전하지 않은 정수와 숫자 오버플로는 문자열이 되고 안전한 값은 JavaScript 숫자로 유지됩니다. ID는 문자열로 전달하세요.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

기본 `baseURL`은 `/v1`이 없는 `https://api.requestbeam.com`입니다. 사용자 지정 오리진은 HTTPS여야 하며 경로, 자격 증명, 쿼리나 프래그먼트를 포함할 수 없습니다. 리디렉션은 차단됩니다. 기본 `timeoutMs: 60000`은 요청과 스트림 전체에 적용됩니다. 긴 생성에는 `600000`을 사용하세요. 모든 네트워크 메서드는 선택적 `{ signal, timeoutMs }`를 받으며 먼저 발생한 중단이 우선합니다. 사용자 지정 `fetch`는 호출자가 신뢰하는 코드입니다. API 키는 서버나 환경 변수에 보관하고 브라우저 코드나 Git에 넣지 마세요.

## 스트리밍 및 작업

`streamChatCompletions`, `streamResponses`, `streamMessages`, `streamImage`는 `event`, `data`, `id`, `json()`을 가진 비동기 반복자를 반환합니다. 모든 이벤트가 텍스트를 포함하지는 않습니다. `[DONE]`은 내부 처리되며 루프를 종료하거나 중단하면 읽기가 멈춥니다. 스트림 오류와 조기 종료는 실패로 처리됩니다. 이벤트 한도는 64 MiB입니다. `response.incomplete`는 종료 이벤트이지만 결과는 불완전합니다. 상태와 `incomplete_details`를 확인하세요.

이미지는 동영상 Jobs 없이 JSON 또는 SSE를 직접 반환합니다. `generateVideo`는 `data.jobId`를 반환합니다. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })`는 `COMPLETED`에서 전체 Jobs 응답을 반환하고 `FAILED`, `CANCELLED`에서 `JobFailedError`를 발생시킵니다. 시간 초과는 `PollingTimeoutError`입니다. 로컬 취소나 시간 초과가 원격 작업 또는 과금을 중단하지는 않습니다. 비스트리밍 메서드는 `stream: true`를 거부합니다.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb 및 Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })`는 공개 작업 27개와 원래 필드를 지원합니다. 전 세계 데이터만 제공됩니다 (`country=999`). 허용되는 다른 국가 값도 전 세계 데이터를 반환합니다. 필요한 경우 `from`, `to`를 함께 전달하세요. 날짜는 수정하지 않습니다. 빈 결과가 트래픽이 0임을 뜻하지는 않습니다. Twitter 메서드는 사용자 이름, ID와 타임라인을 지원합니다. `twitterUserTweetPages(id, query, { maxPages: 3 })`는 `meta.next_token`으로 전체 페이지를 반환하고 반복 커서를 거부하며 명시한 한도에서 멈춥니다. 전체 타임라인을 보장하지 않습니다. 각 페이지에 요금이 발생할 수 있습니다.

## 오류 및 검증

`APIError`는 `statusCode`, 서비스 `code`/`type`, `requestId`, `retryAfter`, 원래 `body`를 보존합니다. `SDKError`는 로컬, 프로토콜 및 전송 오류를 나타냅니다. SDK는 GET을 포함해 자동 재시도하지 않습니다. 네트워크 오류만으로 처리나 과금이 없었다고 판단할 수 없습니다. 파일은 자동 다운로드하지 않으며 신뢰할 수 있는 URL에는 별도의 인증 없는 클라이언트를 사용하세요. 비공개 본문이나 키를 로그에 남기지 마세요. 테스트는 모의 응답을 사용하지만 예제는 실제 요청을 보내 요금이 발생할 수 있습니다.

이 명령은 저장소를 복제한 디렉터리에서 실행하세요. 로컬 테스트와 CI는 실제 공급자 가용성이나 프로덕션 배포를 증명하지 않습니다.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## 예제 및 참조

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/ko) | [API docs](https://requestbeam.com/ko/docs/api-reference/models)
