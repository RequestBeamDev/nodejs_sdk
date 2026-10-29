# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

Клиент Node.js и TypeScript для API текста, изображений, видео, Similarweb и Twitter RequestBeam. Поддерживает отмену запросов, SSE, ограниченный опрос и пагинацию, а также сообщения SDK на всех 12 языках проекта.

## Установка и начало работы

Требуется Node.js 20 или новее. Устанавливайте прямо из этого Git-репозитория; публикация в реестре npm не предполагается. Для воспроизводимых сборок закрепите коммит в Git URL (`#<commit>`) и сохраните lock-файл. Выберите через `client.listModels()` модель, подходящую для эндпоинта и вашего аккаунта; запись в каталоге не гарантирует доступность провайдера. Сохраните пример как `.mjs` или используйте ESM.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'ru' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Язык и настройки

`locale` изменяет только сообщения SDK. Поля API, промпты, ID моделей, ошибки сервера и содержимое ответов не переводятся. `supportedLocales` экспортирует перечисленные ниже языки. Псевдонимы `pt`, `cn`, `zh`, `tw`, регистр и подчеркивания нормализуются; неизвестный язык заменяется английским. JSON сохраняет исходную структуру. Небезопасные целые числа и числовые переполнения становятся строками; безопасные значения остаются числами JavaScript. Передавайте ID строками.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

По умолчанию `baseURL` равен `https://api.requestbeam.com`, без `/v1`. Пользовательский origin должен использовать HTTPS без пути, учетных данных, запроса и фрагмента. Перенаправления блокируются. `timeoutMs: 60000` охватывает весь запрос и поток; для долгой генерации задайте `600000`. Все сетевые методы принимают необязательные `{ signal, timeoutMs }`. Более ранняя отмена имеет приоритет. Пользовательский `fetch` считается доверенным кодом вызывающей стороны. Храните ключи на сервере или в окружении, не в браузерном коде и не в Git.

## Потоки и задания

`streamChatCompletions`, `streamResponses`, `streamMessages` и `streamImage` возвращают асинхронные итераторы с `event`, `data`, `id` и `json()`. Не каждое событие содержит текст. `[DONE]` обрабатывается внутри; выход из цикла или отмена прекращают чтение. Ошибки потока и преждевременное завершение вызывают ошибку. Размер события ограничен 64 MiB. `response.incomplete` завершает поток, но результат неполон: проверьте статус и `incomplete_details`.

Изображения возвращают JSON или SSE напрямую, без видео Jobs. `generateVideo` возвращает `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` возвращает полный ответ Jobs при `COMPLETED`; `FAILED` и `CANCELLED` вызывают `JobFailedError`. Истечение срока вызывает `PollingTimeoutError`. Локальная отмена или тайм-аут не останавливают удаленное задание и оплату. Непотоковые методы отклоняют `stream: true`.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb и Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` поддерживает 27 публичных операций и исходные поля. Доступны только мировые данные (`country=999`); другие принимаемые страны также дают мировые данные. Передавайте `from` и `to` вместе, когда это требуется; даты не переписываются. Пустой результат не доказывает отсутствие трафика. Методы Twitter работают с именами, ID и лентами. `twitterUserTweetPages(id, query, { maxPages: 3 })` возвращает целые страницы через `meta.next_token`, отклоняет повторяющиеся курсоры и соблюдает явный предел; полная лента не гарантируется. Каждая страница может оплачиваться отдельно.

## Ошибки и проверка

`APIError` сохраняет `statusCode`, `code`/`type` сервиса, `requestId`, `retryAfter` и исходный `body`. `SDKError` обозначает локальные, протокольные и транспортные ошибки. SDK не повторяет запросы автоматически, включая GET. Сетевая ошибка не исключает обработку и списание средств. Файлы не скачиваются автоматически; используйте отдельный клиент без авторизации для доверенных URL. Не записывайте приватные тела запросов, ответов и ключи в журналы. Тесты используют имитации; примеры отправляют реальные запросы, которые могут быть платными.

Выполняйте эти команды в клоне репозитория. Локальные тесты и CI не подтверждают фактическую доступность провайдера или развертывание в рабочей среде.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Примеры и справочник

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/ru) | [API docs](https://requestbeam.com/ru/docs/api-reference/models)
