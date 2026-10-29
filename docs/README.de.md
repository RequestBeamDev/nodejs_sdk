# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

Ein Node.js- und TypeScript-Client für die Text-, Bild-, Video-, Similarweb- und Twitter-APIs von RequestBeam. Mit abbrechbaren Anfragen, SSE, begrenztem Polling und Seitenabruf sowie SDK-Meldungen in allen 12 Projektsprachen.

## Installation und Einstieg

Node.js 20 oder neuer ist erforderlich. Installieren Sie direkt aus diesem Git-Repository; eine Veröffentlichung in der npm-Registry wird nicht vorausgesetzt. Für reproduzierbare Builds fixieren Sie einen Commit in der Git-URL (`#<commit>`) und behalten die Lockdatei. Wählen Sie mit `client.listModels()` ein für den Endpunkt und Ihr Konto geeignetes Modell; der Katalog garantiert keine Verfügbarkeit. Speichern Sie das Beispiel als `.mjs` oder verwenden Sie ESM.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'de' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Sprache und Konfiguration

`locale` ändert nur SDK-eigene Meldungen. API-Felder, Prompts, Modell-IDs, Serverfehler und Inhalte bleiben unverändert. `supportedLocales` exportiert die folgenden Sprachen. Aliase wie `pt`, `cn`, `zh` und `tw`, Großschreibung und Unterstriche werden normalisiert; unbekannte Sprachen fallen auf Englisch zurück. JSON-Antworten behalten ihre Struktur. Unsichere Ganzzahlen und Zahlenüberläufe werden als Zeichenfolgen erhalten; sichere Werte bleiben JavaScript-Zahlen. Übergeben Sie IDs als Zeichenfolgen.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

Die Standard-`baseURL` ist `https://api.requestbeam.com`, ohne `/v1`. Eigene Ursprünge müssen HTTPS ohne Pfad, Zugangsdaten, Query oder Fragment verwenden. Weiterleitungen werden blockiert. `timeoutMs: 60000` gilt für die gesamte Anfrage und den Stream; für lange Generierungen verwenden Sie `600000`. Alle Netzwerkmethoden akzeptieren optional `{ signal, timeoutMs }`. Ein früherer Abbruch hat Vorrang. Ein eigenes `fetch` ist vertrauenswürdiger Code des Aufrufers. API-Schlüssel gehören auf den Server oder in Umgebungsvariablen, niemals in Browsercode oder Git.

## Streaming und Aufträge

`streamChatCompletions`, `streamResponses`, `streamMessages` und `streamImage` liefern asynchrone Iteratoren mit `event`, `data`, `id` und `json()`. Nicht jedes Ereignis enthält Text. `[DONE]` wird intern verarbeitet; Schleifenabbruch oder Abbruchsignal beendet das Lesen. Streamfehler und vorzeitige Enden führen zu Fehlern. Ereignisse sind auf 64 MiB begrenzt. `response.incomplete` beendet den Stream mit unvollständigem Ergebnis: Prüfen Sie Status und `incomplete_details`.

Bilder liefern JSON oder SSE direkt, ohne Video-Jobs. `generateVideo` liefert `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` gibt bei `COMPLETED` die vollständige Jobs-Antwort zurück; `FAILED` und `CANCELLED` lösen `JobFailedError` aus. Zeitablauf ergibt `PollingTimeoutError`. Lokaler Abbruch oder Zeitablauf beendet weder den entfernten Auftrag noch seine Abrechnung. Methoden ohne Streaming lehnen `stream: true` ab.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb und Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` unterstützt 27 öffentliche Operationen und native Felder. Nur weltweite Daten sind verfügbar (`country=999`); andere akzeptierte Länderwerte liefern ebenfalls weltweite Daten. Geben Sie bei Bedarf `from` und `to` gemeinsam an; Daten werden nicht umgeschrieben. Leere Ergebnisse beweisen keinen fehlenden Traffic. Twitter-Methoden unterstützen Nutzernamen, IDs und Timelines. `twitterUserTweetPages(id, query, { maxPages: 3 })` liefert ganze Seiten über `meta.next_token`, lehnt wiederholte Cursor ab und hält das explizite Limit ein; eine vollständige Timeline ist nicht garantiert. Jede Seite kann berechnet werden.

## Fehler und Prüfung

`APIError` enthält `statusCode`, Dienst-`code`/`type`, `requestId`, `retryAfter` und den ursprünglichen `body`. `SDKError` kennzeichnet lokale, Protokoll- und Transportfehler. Das SDK wiederholt Anfragen nicht automatisch, auch GET nicht. Ein Netzwerkfehler schließt Verarbeitung oder Abrechnung nicht aus. Dateien werden nicht automatisch heruntergeladen; verwenden Sie für vertrauenswürdige Datei-URLs einen separaten Client ohne Authentifizierung. Protokollieren Sie keine privaten Inhalte oder Schlüssel. Tests verwenden Simulationen; Beispiele senden echte, möglicherweise kostenpflichtige Anfragen.

Führen Sie diese Befehle in einem Klon des Repositorys aus. Lokale Tests und CI belegen weder aktuelle Anbieter-Verfügbarkeit noch ein Produktions-Deployment.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Beispiele und Referenz

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/de) | [API docs](https://requestbeam.com/de/docs/api-reference/models)
