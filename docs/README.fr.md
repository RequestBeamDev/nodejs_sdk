# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

Client Node.js et TypeScript pour les API de texte, images, vidéo, Similarweb et Twitter de RequestBeam. Inclut des requêtes annulables, SSE, interrogation et pagination limitées, et des messages SDK dans les 12 langues du projet.

## Installation et démarrage

Node.js 20 ou ultérieur est requis. Installez directement depuis ce dépôt Git ; aucune publication dans le registre npm n’est présumée. Pour des builds reproductibles, fixez un commit dans l’URL Git (`#<commit>`) et conservez le fichier de verrouillage. Choisissez avec `client.listModels()` un modèle adapté à l’endpoint et à votre compte ; le catalogue ne garantit pas la disponibilité du fournisseur. Enregistrez l’exemple en `.mjs` ou utilisez ESM.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'fr' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Langue et configuration

`locale` modifie uniquement les messages du SDK. Les champs API, prompts, ID de modèles, erreurs serveur et contenus restent inchangés. `supportedLocales` exporte les langues ci-dessous. Les alias `pt`, `cn`, `zh`, `tw`, majuscules et traits de soulignement sont normalisés ; une langue inconnue utilise l’anglais. Les réponses JSON gardent leur structure native. Les entiers non sûrs et débordements numériques deviennent des chaînes ; les valeurs sûres restent des nombres JavaScript. Fournissez les ID sous forme de chaînes.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

Le `baseURL` par défaut est `https://api.requestbeam.com`, sans `/v1`. Une origine personnalisée doit utiliser HTTPS sans chemin, identifiants, requête ni fragment. Les redirections sont bloquées. `timeoutMs: 60000` couvre toute la requête et le flux ; utilisez `600000` pour une génération longue. Toutes les méthodes réseau acceptent `{ signal, timeoutMs }` en option. L’annulation la plus précoce prévaut. Un `fetch` personnalisé est du code de confiance fourni par l’appelant. Gardez les clés sur le serveur ou dans l’environnement, jamais dans le navigateur ni dans Git.

## Streaming et tâches

`streamChatCompletions`, `streamResponses`, `streamMessages` et `streamImage` renvoient des itérateurs asynchrones avec `event`, `data`, `id` et `json()`. Tous les événements ne contiennent pas du texte. `[DONE]` est traité en interne ; quitter la boucle ou annuler arrête la lecture. Les erreurs et fins prématurées provoquent un échec. Chaque événement est limité à 64 MiB. `response.incomplete` termine le flux avec un résultat incomplet : vérifiez le statut et `incomplete_details`.

Les images renvoient directement JSON ou SSE, sans Jobs vidéo. `generateVideo` renvoie `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` renvoie toute la réponse Jobs à `COMPLETED` ; `FAILED` et `CANCELLED` lèvent `JobFailedError`. Le dépassement du délai lève `PollingTimeoutError`. L’annulation ou l’expiration locale ne stoppe ni la tâche distante ni sa facturation. Les méthodes sans streaming refusent `stream: true`.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb et Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` prend en charge 27 opérations publiques et les champs natifs. Seules les données mondiales sont disponibles (`country=999`) ; les autres pays acceptés produisent aussi des données mondiales. Fournissez `from` et `to` ensemble si nécessaire ; les dates ne sont pas réécrites. Des résultats vides ne prouvent pas un trafic nul. Les méthodes Twitter couvrent noms d’utilisateur, ID et timelines. `twitterUserTweetPages(id, query, { maxPages: 3 })` fournit des pages complètes via `meta.next_token`, refuse les curseurs répétés et respecte la limite explicite ; une timeline complète n’est pas garantie. Chaque page peut être facturée.

## Erreurs et vérification

`APIError` conserve `statusCode`, les `code`/`type` du service, `requestId`, `retryAfter` et le `body` original. `SDKError` identifie les erreurs locales, de protocole et de transport. Le SDK ne retente jamais automatiquement, même GET. Une erreur réseau n’exclut pas un traitement ou une facturation. Les fichiers ne sont pas téléchargés automatiquement ; utilisez un client séparé sans authentification pour les URL fiables. Ne journalisez pas de corps privés ni de clés. Les tests utilisent des simulations ; les exemples envoient de vraies requêtes potentiellement payantes.

Exécutez ces commandes depuis un clone du dépôt. Les tests locaux et CI ne prouvent ni la disponibilité réelle du fournisseur ni un déploiement en production.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Exemples et référence

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/fr) | [API docs](https://requestbeam.com/fr/docs/api-reference/models)
