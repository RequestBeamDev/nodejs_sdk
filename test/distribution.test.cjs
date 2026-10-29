const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { RequestBeam, supportedLocales, normalizeLocale } = require('../dist/index.js');

const root = path.resolve(__dirname, '..');

test('CommonJS and ESM named imports expose the same constructor', async () => {
    const commonJS = require('../dist/index.js');
    const esm = await import('../dist/index.js');
    assert.equal(esm.RequestBeam, commonJS.RequestBeam);
    assert.equal(esm.APIError, commonJS.APIError);
    assert.deepEqual(esm.supportedLocales, commonJS.supportedLocales);
});

test('all locales contain every SDK error message with no empty entries', () => {
    const messages = JSON.parse(fs.readFileSync(path.join(root, 'src/messages.json'), 'utf8'));
    assert.deepEqual(new Set(Object.keys(messages)), new Set(supportedLocales));
    for (const locale of supportedLocales) {
        assert.deepEqual(Object.keys(messages[locale]).sort(), Object.keys(messages.en).sort(), locale);
        for (const [key, value] of Object.entries(messages[locale])) {
            assert.equal(typeof value, 'string', `${locale}:${key}`);
            assert.ok(value.trim().length > 0, `${locale}:${key}`);
        }
    }
});

test('locale aliases match project public paths and unsupported locales fall back to English', () => {
    for (const [input, output] of Object.entries({ CN: 'zh-CN', zh: 'zh-CN', 'zh-Hans': 'zh-CN', TW: 'zh-TW', 'zh-Hant': 'zh-TW', zh_TW: 'zh-TW', pt: 'pt-BR', pt_br: 'pt-BR', ' DE ': 'de', unknown: 'en' })) {
        assert.equal(normalizeLocale(input), output);
    }
    for (const locale of ['constructor', '__proto__', 'toString']) {
        assert.equal(normalizeLocale(locale), 'en');
        assert.equal(new RequestBeam({ apiKey: 'mock-key', locale }).locale, 'en');
    }
});

test('every public language has a README and local Markdown links resolve', () => {
    const files = supportedLocales.map(locale => locale === 'en' ? 'README.md' : `docs/README.${locale}.md`);
    for (const file of files) {
        const absolute = path.join(root, file);
        assert.ok(fs.existsSync(absolute), file);
        const markdown = fs.readFileSync(absolute, 'utf8');
        assert.ok(markdown.includes('RequestBeam'), file);
        assert.ok(markdown.includes('dev@requestbeam.com') || markdown.includes('REQUESTBEAM_API_KEY'), file);
        for (const match of markdown.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
            const link = match[1];
            if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(link)) continue;
            const target = decodeURIComponent(link.split('#')[0]);
            assert.ok(fs.existsSync(path.resolve(path.dirname(absolute), target)), `${file}: ${link}`);
        }
    }
});

test('README JavaScript examples parse as modules without running paid requests', () => {
    for (const locale of supportedLocales) {
        const file = locale === 'en' ? 'README.md' : `docs/README.${locale}.md`;
        const markdown = fs.readFileSync(path.join(root, file), 'utf8');
        for (const match of markdown.matchAll(/```(?:js|javascript|mjs)\s*\n([\s\S]*?)```/g)) {
            const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: match[1], encoding: 'utf8' });
            assert.equal(result.status, 0, `${file}: ${result.stderr}`);
        }
    }
});
