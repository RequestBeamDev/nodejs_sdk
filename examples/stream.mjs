import { RequestBeam } from '../dist/index.js';

const model = process.env.REQUESTBEAM_TEXT_MODEL;
if (!model) throw new Error('Set REQUESTBEAM_TEXT_MODEL to a model supported by your account.');

const client = new RequestBeam({ timeoutMs: 600_000 });
for await (const event of client.streamChatCompletions({
    model,
    messages: [{ role: 'user', content: 'Hello' }],
})) {
    console.log(event.event, event.json());
}
