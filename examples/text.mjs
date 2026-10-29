import { RequestBeam } from '../dist/index.js';

const model = process.env.REQUESTBEAM_TEXT_MODEL;
if (!model) throw new Error('Set REQUESTBEAM_TEXT_MODEL to a model supported by your account.');

const client = new RequestBeam();
const result = await client.chatCompletions({
    model,
    messages: [{ role: 'user', content: 'Hello' }],
});
console.log(JSON.stringify(result, null, 2));
