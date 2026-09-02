const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') {
    return {
      Plugin: class {},
      Notice: class {},
      requestUrl: async ({ url }) => {
        const text = new URL(url).searchParams.get('q');
        return { json: [[[text]]] };
      },
      addIcon: () => {},
      TFile: class {},
      PluginSettingTab: class {},
      Setting: class {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const QuickZh = require('../main.js');
const { chunk, splitLongText, mapConcurrent, sanitize, uniquePath, translateBody } = QuickZh._test;
Module._load = originalLoad;

test('splitLongText never leaves a chunk over the provider limit', () => {
  const parts = splitLongText('x'.repeat(2501), 1000);
  assert.deepEqual(parts.map(part => part.length), [1000, 1000, 501]);
});

test('chunk keeps every generated request within the limit', () => {
  const parts = chunk(`short\n\n${'x'.repeat(2501)}`, 1000);
  assert.equal(parts.every(part => part.length <= 1000), true);
  assert.equal(parts.join('').replace('short', '').length, 2501);
});

test('mapConcurrent preserves order and respects the concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const output = await mapConcurrent([30, 5, 20, 1], 2, async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, value));
    active--;
    return value * 2;
  });
  assert.deepEqual(output, [60, 10, 40, 2]);
  assert.equal(peak, 2);
});

test('uniquePath never overwrites an existing translated note', () => {
  const existing = new Set(['folder/中文标题.md', 'folder/中文标题 1.md']);
  const vault = { getAbstractFileByPath: path => existing.has(path) ? {} : null };
  assert.equal(uniquePath(vault, 'folder/', '中文标题'), 'folder/中文标题 2.md');
});

test('sanitize removes characters that are invalid in note names', () => {
  assert.equal(sanitize(' a/b:c*?[d]  e '), 'a b c d e');
});

test('translateBody preserves whitespace around fenced code blocks', async () => {
  const body = 'Paragraph before.\n\n```javascript\nconst x = 1;\n```\n\nParagraph after.';
  const output = await translateBody(body, { provider: 'google', targetLang: 'zh-CN' });
  assert.equal(output, body);
});

test('loadSecrets migrates plaintext keys out of plugin data', async () => {
  const secrets = new Map();
  let persisted;
  const plugin = Object.create(QuickZh.prototype);
  plugin.app = {
    secretStorage: {
      getSecret: key => secrets.get(key) || null,
      setSecret: (key, value) => secrets.set(key, value),
    },
  };
  plugin.settings = { deeplKey: 'deep-secret', llmKey: 'llm-secret', provider: 'llm' };
  plugin.saveData = async data => { persisted = data; };

  await plugin.loadSecrets({ deeplKey: 'deep-secret', llmKey: 'llm-secret', provider: 'llm' });

  assert.equal(secrets.get('quick-zh-deepl-key'), 'deep-secret');
  assert.equal(secrets.get('quick-zh-llm-key'), 'llm-secret');
  assert.equal('deeplKey' in persisted, false);
  assert.equal('llmKey' in persisted, false);
});
