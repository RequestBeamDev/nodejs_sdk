import { RequestBeam } from '../dist/index.js';

const client = new RequestBeam();
const result = await client.similarweb('websites/visits', {
    keys: 'example.com',
    country: 999,
});
console.log(JSON.stringify(result, null, 2));
