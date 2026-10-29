# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

RequestBeam metin, görsel, video, Similarweb ve Twitter API’leri için Node.js ve TypeScript istemcisi. İptal edilebilir istekler, SSE akışları, sınırlı sorgulama ve sayfalama ile projenin 12 dilinde SDK mesajları sunar.

## Kurulum ve başlangıç

Node.js 20 veya üzeri gerekir. Doğrudan bu Git deposundan kurun; npm kayıt deposunda yayımlandığı varsayılmaz. Tekrarlanabilir derlemeler için Git URL’sinde bir commit sabitleyin (`#<commit>`) ve kilit dosyasını koruyun. `client.listModels()` ile uç nokta ve hesabınıza uygun modeli seçin; katalog sağlayıcı kullanılabilirliğini garanti etmez. Örneği `.mjs` olarak kaydedin veya uygulamada ESM kullanın.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'tr' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Dil ve yapılandırma

`locale` yalnızca SDK mesajlarını değiştirir. API alanları, istemler, model kimlikleri, sunucu hataları ve sonuç içeriği değişmez. `supportedLocales` aşağıdaki dilleri sunar. `pt`, `cn`, `zh`, `tw` takma adları, büyük harf ve alt çizgi kullanımı normalleştirilir; bilinmeyen diller İngilizceye döner. JSON yanıtları özgün yapısını korur. Güvenli olmayan tam sayılar ve taşan sayılar metin olarak korunur; güvenli değerler JavaScript sayısı kalır. Kimlikleri metin olarak gönderin.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

Varsayılan `baseURL`, `/v1` içermeyen `https://api.requestbeam.com` adresidir. Özel köken HTTPS kullanmalı; yol, kimlik bilgisi, sorgu veya parça içermemelidir. Yönlendirmeler engellenir. `timeoutMs: 60000` tüm istek ve akışı kapsar; uzun üretimler için `600000` kullanın. Tüm ağ yöntemleri isteğe bağlı `{ signal, timeoutMs }` kabul eder. Daha erken iptal önceliklidir. Özel `fetch`, çağıranın güvendiği koddur. API anahtarlarını sunucuda veya ortam değişkenlerinde tutun; tarayıcı koduna ya da Git’e koymayın.

## Akış ve işler

`streamChatCompletions`, `streamResponses`, `streamMessages` ve `streamImage`, `event`, `data`, `id`, `json()` içeren asenkron yineleyiciler döndürür. Her olay metin içermez. `[DONE]` içeride işlenir; döngüden çıkış veya iptal okumayı durdurur. Akış hataları ve erken bitişler hata üretir. Olay sınırı 64 MiB’dir. `response.incomplete` akışı sonlandırır ama sonuç eksiktir; durum ve `incomplete_details` alanını inceleyin.

Görseller video Jobs kullanmadan doğrudan JSON veya SSE döndürür. `generateVideo`, `data.jobId` döndürür. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })`, `COMPLETED` durumunda tüm Jobs yanıtını döndürür; `FAILED` ve `CANCELLED`, `JobFailedError` üretir. Süre aşımı `PollingTimeoutError` üretir. Yerel iptal veya süre aşımı uzak işi ya da faturalandırmayı durdurmaz. Akışsız yöntemler `stream: true` değerini reddeder.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb ve Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })`, 27 genel işlemi ve özgün alanları destekler. Yalnızca dünya geneli veri vardır (`country=999`); kabul edilen diğer ülke değerleri de dünya verisi döndürür. Gerektiğinde `from` ve `to` birlikte gönderilmelidir; tarihler değiştirilmez. Boş sonuç sıfır trafiği kanıtlamaz. Twitter yöntemleri kullanıcı adı, kimlik ve zaman akışını kapsar. `twitterUserTweetPages(id, query, { maxPages: 3 })`, `meta.next_token` ile tam sayfalar verir, tekrar eden imleçleri reddeder ve açık sınırda durur; tüm zaman akışını garanti etmez. Her sayfa ücretlendirilebilir.

## Hatalar ve doğrulama

`APIError`, `statusCode`, hizmet `code`/`type`, `requestId`, `retryAfter` ve özgün `body` değerlerini korur. `SDKError` yerel, protokol ve aktarım hatalarını belirtir. SDK, GET dahil otomatik yeniden deneme yapmaz. Ağ hatası isteğin işlenmediği veya ücretlendirilmediği anlamına gelmez. Dosyalar otomatik indirilmez; güvenilir dosya URL’leri için ayrı, kimlik doğrulamasız istemci kullanın. Özel içerik veya anahtarları günlüklere yazmayın. Testler simülasyon kullanır; örnekler gerçek ve ücretli olabilen istekler gönderir.

Bu komutları deponun bir klonunda çalıştırın. Yerel testler ve CI, canlı sağlayıcı kullanılabilirliğini veya üretim dağıtımını kanıtlamaz.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Örnekler ve başvuru

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/tr) | [API docs](https://requestbeam.com/tr/docs/api-reference/models)
