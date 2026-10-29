# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

Client Node.js e TypeScript per le API di testo, immagini, video, Similarweb e Twitter di RequestBeam. Include richieste annullabili, SSE, polling e paginazione limitati e messaggi SDK nelle 12 lingue del progetto.

## Installazione e avvio

Richiede Node.js 20 o successivo. Installa direttamente da questo repository Git; non si presume una pubblicazione nel registro npm. Per build riproducibili, fissa un commit nell’URL Git (`#<commit>`) e conserva il lockfile. Scegli con `client.listModels()` un modello adatto all’endpoint e al tuo account; il catalogo non garantisce la disponibilità del fornitore. Salva l’esempio come `.mjs` oppure usa ESM.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'it' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Lingua e configurazione

`locale` modifica soltanto i messaggi del SDK. Campi API, prompt, ID dei modelli, errori del server e contenuti restano invariati. `supportedLocales` esporta le lingue seguenti. Alias come `pt`, `cn`, `zh`, `tw`, maiuscole e trattini bassi vengono normalizzati; le lingue sconosciute usano l’inglese. Le risposte JSON conservano la struttura nativa. Interi non sicuri e overflow numerici diventano stringhe; i valori sicuri restano numeri JavaScript. Passa gli ID come stringhe.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

Il `baseURL` predefinito è `https://api.requestbeam.com`, senza `/v1`. Le origini personalizzate devono usare HTTPS senza percorso, credenziali, query o frammento. I reindirizzamenti sono bloccati. `timeoutMs: 60000` copre l’intera richiesta e lo stream; usa `600000` per generazioni lunghe. Tutti i metodi di rete accettano `{ signal, timeoutMs }` opzionale. Prevale l’annullamento più precoce. Un `fetch` personalizzato è codice fidato del chiamante. Conserva le chiavi sul server o nell’ambiente, mai nel browser o in Git.

## Streaming e processi

`streamChatCompletions`, `streamResponses`, `streamMessages` e `streamImage` restituiscono iteratori asincroni con `event`, `data`, `id` e `json()`. Non ogni evento contiene testo. `[DONE]` viene gestito internamente; uscire dal ciclo o annullare interrompe la lettura. Errori e terminazioni premature producono un errore. Ogni evento è limitato a 64 MiB. `response.incomplete` termina lo stream ma indica un risultato incompleto: controlla stato e `incomplete_details`.

Le immagini restituiscono direttamente JSON o SSE, senza Jobs video. `generateVideo` restituisce `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` restituisce l’intera risposta Jobs a `COMPLETED`; `FAILED` e `CANCELLED` generano `JobFailedError`. La scadenza genera `PollingTimeoutError`. Annullamento o scadenza locali non interrompono il processo remoto né la fatturazione. I metodi senza streaming rifiutano `stream: true`.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb e Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` supporta 27 operazioni pubbliche e campi nativi. Sono disponibili solo dati mondiali (`country=999`); anche gli altri paesi accettati restituiscono dati mondiali. Passa `from` e `to` insieme quando richiesto; le date non vengono riscritte. Risultati vuoti non provano traffico nullo. I metodi Twitter coprono nomi utente, ID e timeline. `twitterUserTweetPages(id, query, { maxPages: 3 })` restituisce pagine complete tramite `meta.next_token`, rifiuta cursori ripetuti e si ferma al limite esplicito; non garantisce una timeline completa. Ogni pagina può essere fatturata.

## Errori e verifica

`APIError` conserva `statusCode`, `code`/`type` del servizio, `requestId`, `retryAfter` e il `body` originale. `SDKError` identifica errori locali, di protocollo e trasporto. Il SDK non ritenta automaticamente, nemmeno GET. Un errore di rete non esclude elaborazione o addebito. I file non vengono scaricati automaticamente; usa un client separato senza autenticazione per URL fidati. Non registrare contenuti privati o chiavi. I test usano simulazioni; gli esempi inviano richieste reali potenzialmente a pagamento.

Esegui questi comandi da un clone del repository. Test locali e CI non dimostrano la disponibilità effettiva del fornitore o un rilascio in produzione.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Esempi e riferimento

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/it) | [API docs](https://requestbeam.com/it/docs/api-reference/models)
