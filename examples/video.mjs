import { RequestBeam } from '../dist/index.js';

const model = process.env.REQUESTBEAM_VIDEO_MODEL;
if (!model) throw new Error('Set REQUESTBEAM_VIDEO_MODEL to a Seedance model supported by your account.');

const client = new RequestBeam();
const created = await client.generateVideo({
    model,
    prompt: 'A small sailboat crossing a calm lake.',
    duration: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    generateAudio: false,
});
const jobId = created.data?.jobId;
if (typeof jobId !== 'string') throw new Error('Expected data.jobId as a string.');
const result = await client.waitForJob(jobId, {
    timeoutMs: 600_000,
    pollIntervalMs: 5_000,
});
console.log(JSON.stringify(result, null, 2));
