# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

Cliente Node.js y TypeScript para las API de texto, imágenes, vídeo, Similarweb y Twitter de RequestBeam. Incluye solicitudes cancelables, SSE, consultas y paginación limitadas y mensajes del SDK en los 12 idiomas del proyecto.

## Instalación e inicio

Requiere Node.js 20 o posterior. Instala directamente desde este repositorio Git; no se presupone una publicación en el registro npm. Para compilaciones reproducibles, fija un commit en la URL Git (`#<commit>`) y conserva el archivo de bloqueo. Elige con `client.listModels()` un modelo adecuado para el endpoint y tu cuenta; el catálogo no garantiza disponibilidad del proveedor. Guarda el ejemplo como `.mjs` o usa ESM.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'es' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Idioma y configuración

`locale` solo cambia los mensajes propios del SDK. Los campos API, prompts, ID de modelos, errores del servidor y contenido no se traducen. `supportedLocales` exporta los idiomas siguientes. Se normalizan alias como `pt`, `cn`, `zh`, `tw`, mayúsculas y guiones bajos; los idiomas desconocidos usan inglés. Las respuestas JSON mantienen su estructura nativa. Los enteros no seguros y desbordamientos numéricos se conservan como cadenas; los valores seguros siguen siendo números JavaScript. Pasa los ID como cadenas.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

El `baseURL` predeterminado es `https://api.requestbeam.com`, sin `/v1`. Los orígenes personalizados deben usar HTTPS sin ruta, credenciales, consulta ni fragmento. Se bloquean las redirecciones. `timeoutMs: 60000` cubre toda la solicitud y el stream; usa `600000` para generaciones largas. Todos los métodos de red aceptan `{ signal, timeoutMs }` opcional. Prevalece la cancelación más temprana. Un `fetch` personalizado es código de confianza del llamador. Guarda las claves en el servidor o en variables de entorno, nunca en código del navegador ni en Git.

## Streaming y trabajos

`streamChatCompletions`, `streamResponses`, `streamMessages` y `streamImage` devuelven iteradores asíncronos con `event`, `data`, `id` y `json()`. No todos los eventos contienen texto. `[DONE]` se procesa internamente; salir del bucle o cancelar detiene la lectura. Los errores y finales prematuros producen un fallo. Cada evento se limita a 64 MiB. `response.incomplete` termina el stream, pero el resultado está incompleto: revisa el estado y `incomplete_details`.

Las imágenes devuelven JSON o SSE directamente, sin Jobs de vídeo. `generateVideo` devuelve `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` devuelve la respuesta Jobs completa en `COMPLETED`; `FAILED` y `CANCELLED` lanzan `JobFailedError`. El vencimiento lanza `PollingTimeoutError`. Cancelar o agotar el tiempo local no detiene el trabajo remoto ni su facturación. Los métodos sin streaming rechazan `stream: true`.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb y Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` admite 27 operaciones públicas y campos nativos. Solo hay datos mundiales (`country=999`); otros países aceptados también devuelven datos mundiales. Pasa `from` y `to` juntos cuando se requiera; las fechas no se reescriben. Los resultados vacíos no prueban tráfico cero. Los métodos Twitter cubren nombres de usuario, ID y cronologías. `twitterUserTweetPages(id, query, { maxPages: 3 })` entrega páginas completas usando `meta.next_token`, rechaza cursores repetidos y respeta el límite explícito; no garantiza una cronología completa. Cada página puede tener coste.

## Errores y verificación

`APIError` conserva `statusCode`, `code`/`type` del servicio, `requestId`, `retryAfter` y el `body` original. `SDKError` identifica errores locales, de protocolo y transporte. El SDK no reintenta automáticamente, ni siquiera GET. Un error de red no excluye que se haya procesado o cobrado la solicitud. Los archivos no se descargan automáticamente; usa otro cliente sin autenticación para URL fiables. No registres cuerpos privados ni claves. Las pruebas usan simulaciones; los ejemplos envían solicitudes reales que pueden generar cargos.

Ejecuta estos comandos desde un clon del repositorio. Las pruebas locales y CI no demuestran disponibilidad real del proveedor ni un despliegue de producción.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Ejemplos y referencia

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/es) | [API docs](https://requestbeam.com/es/docs/api-reference/models)
