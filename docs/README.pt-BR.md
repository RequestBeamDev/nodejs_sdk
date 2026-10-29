# RequestBeam Node.js SDK

[English](../README.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md) | [Italiano](README.it.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt-BR.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

Cliente Node.js e TypeScript para as APIs de texto, imagem, vídeo, Similarweb e Twitter da RequestBeam. Inclui solicitações canceláveis, SSE, consulta e paginação limitadas e mensagens do SDK nos 12 idiomas do projeto.

## Instalação e início

Requer Node.js 20 ou mais recente. Instale diretamente deste repositório Git; não se pressupõe publicação no registro npm. Para builds reproduzíveis, fixe um commit na URL Git (`#<commit>`) e mantenha o arquivo de lock. Escolha com `client.listModels()` um modelo adequado ao endpoint e à sua conta; o catálogo não garante disponibilidade do provedor. Salve o exemplo como `.mjs` ou use ESM.

```bash
npm install git+https://github.com/RequestBeamDev/nodejs_sdk.git
export REQUESTBEAM_API_KEY="YOUR_API_KEY"
export REQUESTBEAM_TEXT_MODEL="YOUR_TEXT_MODEL_ID"
```

```javascript
import { RequestBeam } from '@requestbeam/nodejs-sdk';

const client = new RequestBeam({ locale: 'pt-BR' });
const result = await client.chatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
```

## Idioma e configuração

`locale` altera apenas mensagens do SDK. Campos da API, prompts, IDs de modelos, erros do servidor e conteúdo permanecem iguais. `supportedLocales` exporta os idiomas abaixo. Aliases como `pt`, `cn`, `zh`, `tw`, maiúsculas e sublinhados são normalizados; idiomas desconhecidos usam inglês. As respostas JSON mantêm a estrutura original. Inteiros não seguros e estouros numéricos viram strings; valores seguros continuam números JavaScript. Passe IDs como strings.

`en`, `de`, `tr`, `it`, `es`, `fr`, `pt-BR`, `ja`, `ko`, `zh-CN`, `zh-TW`, `ru`.

O `baseURL` padrão é `https://api.requestbeam.com`, sem `/v1`. Origens personalizadas devem usar HTTPS sem caminho, credenciais, consulta ou fragmento. Redirecionamentos são bloqueados. `timeoutMs: 60000` cobre toda a solicitação e o stream; use `600000` para gerações longas. Todos os métodos de rede aceitam `{ signal, timeoutMs }` opcional. O cancelamento mais cedo prevalece. Um `fetch` personalizado é código confiável do chamador. Mantenha chaves no servidor ou em variáveis de ambiente, nunca no navegador ou no Git.

## Streaming e tarefas

`streamChatCompletions`, `streamResponses`, `streamMessages` e `streamImage` retornam iteradores assíncronos com `event`, `data`, `id` e `json()`. Nem todo evento contém texto. `[DONE]` é tratado internamente; sair do laço ou cancelar interrompe a leitura. Erros e encerramentos prematuros geram falha. Cada evento tem limite de 64 MiB. `response.incomplete` encerra o stream, mas o resultado está incompleto: examine status e `incomplete_details`.

Imagens retornam JSON ou SSE diretamente, sem Jobs de vídeo. `generateVideo` retorna `data.jobId`. `waitForJob(jobId, { timeoutMs: 600000, pollIntervalMs: 5000 })` retorna toda a resposta Jobs em `COMPLETED`; `FAILED` e `CANCELLED` lançam `JobFailedError`. O prazo excedido lança `PollingTimeoutError`. Cancelar ou expirar localmente não interrompe a tarefa remota nem a cobrança. Métodos sem streaming rejeitam `stream: true`.

```javascript
for await (const event of client.streamChatCompletions({
    model: process.env.REQUESTBEAM_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
}, { timeoutMs: 600_000 })) {
    console.log(event.event, event.json());
}
```

## Similarweb e Twitter

`similarweb("websites/visits", { keys: "example.com", country: 999 })` suporta 27 operações públicas e campos nativos. Apenas dados mundiais estão disponíveis (`country=999`); outros países aceitos também retornam dados mundiais. Passe `from` e `to` juntos quando necessário; datas não são reescritas. Resultados vazios não provam tráfego zero. Métodos Twitter cobrem nomes de usuário, IDs e timelines. `twitterUserTweetPages(id, query, { maxPages: 3 })` fornece páginas completas por `meta.next_token`, rejeita cursores repetidos e respeita o limite explícito; não garante a timeline completa. Cada página pode ser cobrada.

## Erros e verificação

`APIError` preserva `statusCode`, `code`/`type` do serviço, `requestId`, `retryAfter` e o `body` original. `SDKError` identifica falhas locais, de protocolo e transporte. O SDK não tenta novamente automaticamente, nem GET. Um erro de rede não exclui processamento ou cobrança. Arquivos não são baixados automaticamente; use outro cliente sem autenticação para URLs confiáveis. Não registre corpos privados nem chaves. Testes usam simulações; exemplos enviam solicitações reais que podem gerar cobrança.

Execute estes comandos em um clone do repositório. Testes locais e CI não comprovam disponibilidade real do provedor nem implantação em produção.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Exemplos e referência

[text.mjs](../examples/text.mjs) | [stream.mjs](../examples/stream.mjs) | [video.mjs](../examples/video.mjs) | [data.mjs](../examples/data.mjs)

[API](api-reference.md) | [Design](design.md) | [RequestBeam](https://requestbeam.com/pt) | [API docs](https://requestbeam.com/pt/docs/api-reference/models)
