const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const capturedRequests = [];
let onRequest;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') {
    return {
      Plugin: class {},
      Notice: class {},
      requestUrl: async request => {
        const { url, body } = request;
        capturedRequests.push(request);
        if (onRequest) await onRequest(request);
        if (url.endsWith('/v1/messages')) {
          const text = JSON.parse(body).messages[0].content;
          return { status: 200, json: { content: [{ type: 'text', text }] } };
        }
        if (url.endsWith('/chat/completions')) {
          const text = JSON.parse(body).messages[1].content;
          return { status: 200, json: { choices: [{ message: { content: text.replace(/\$/g, '').replace(/\\mathbf/g, 'mathbf') } }] } };
        }
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
const { chunk, splitLongText, mapConcurrent, sanitize, uniquePath, translateMarkdownText, translateBody, withRetry, providerConcurrency } = QuickZh._test;
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

test('Markdown translation never sends link destinations or bare URLs to the provider', async () => {
  const source = 'Read [story](https://example.com/story) at https://x.com/@author.';
  assert.equal(await translateMarkdownText(source, { provider: 'google', targetLang: 'zh-CN' }), source);
});

test('Markdown translation preserves inline and display math when an LLM would alter it', async () => {
  const settings = {
    provider: 'llm',
    llmEndpoint: 'https://example.com/v1',
    llmKey: 'test',
    llmModel: 'test',
    llmConcurrency: 2,
  };
  const source = 'Weight $\\mathbf{W}_b \\in \\mathbb{R}^{d \\times c}$.\n\n$$E = mc^2$$';
  assert.equal(await translateMarkdownText(source, settings), source);
});

test('Markdown translation preserves blank lines around protected elements', async () => {
  const settings = {
    provider: 'llm',
    llmEndpoint: 'https://example.com/v1',
    llmKey: 'test',
    llmModel: 'test',
    llmConcurrency: 2,
  };
  const source = 'First paragraph.\n\n[Docs](https://example.com/docs).\n\nInline $E = mc^2$.\n\nLast paragraph.';
  assert.equal(await translateMarkdownText(source, settings), source);
});

test('Markdown translation preserves parenthesized LaTeX and math inside link labels', async () => {
  const settings = {
    provider: 'llm',
    llmEndpoint: 'https://example.com/v1',
    llmKey: 'test',
    llmModel: 'test',
    llmConcurrency: 2,
  };
  const source = 'See \\(x + y\\), \\[z^2\\], and [$x$ docs](https://example.com/math).';
  assert.equal(await translateMarkdownText(source, settings), source);
});

test('DeepSeek preset uses the official endpoint, selected model, and non-thinking mode', async () => {
  capturedRequests.length = 0;
  const source = 'Translate this paragraph.';
  const settings = {
    provider: 'deepseek',
    deepseekKey: 'ds-test-key',
    deepseekModel: 'deepseek-flash',
    deepseekConcurrency: 2,
  };
  assert.equal(await translateMarkdownText(source, settings), source);
  const request = capturedRequests.at(-1);
  const payload = JSON.parse(request.body);
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer ds-test-key');
  assert.equal(payload.model, 'deepseek-flash');
  assert.deepEqual(payload.thinking, { type: 'disabled' });
});

test('OpenAI provider uses its official endpoint and separate credentials', async () => {
  capturedRequests.length = 0;
  const settings = {
    provider: 'openai',
    openaiKey: 'openai-test-key',
    openaiModel: 'gpt-4.1-mini',
    openaiConcurrency: 2,
  };
  assert.equal(await translateMarkdownText('Translate this paragraph.', settings), 'Translate this paragraph.');
  const request = capturedRequests.at(-1);
  const payload = JSON.parse(request.body);
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer openai-test-key');
  assert.equal(payload.model, 'gpt-4.1-mini');
});

test('Claude provider uses the Messages API schema and separate credentials', async () => {
  capturedRequests.length = 0;
  const settings = {
    provider: 'claude',
    claudeKey: 'claude-test-key',
    claudeModel: 'claude-sonnet-5',
    claudeConcurrency: 2,
  };
  assert.equal(await translateMarkdownText('Translate this paragraph.', settings), 'Translate this paragraph.');
  const request = capturedRequests.at(-1);
  const payload = JSON.parse(request.body);
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.headers['x-api-key'], 'claude-test-key');
  assert.equal(request.headers['anthropic-version'], '2023-06-01');
  assert.equal(payload.model, 'claude-sonnet-5');
  assert.equal(payload.messages[0].role, 'user');
  assert.equal(typeof payload.system, 'string');
});

test('all AI providers use their own bounded concurrency setting', () => {
  assert.equal(providerConcurrency({ provider: 'deepseek', deepseekConcurrency: 3 }), 3);
  assert.equal(providerConcurrency({ provider: 'openai', openaiConcurrency: 4 }), 4);
  assert.equal(providerConcurrency({ provider: 'claude', claudeConcurrency: 5 }), 5);
  assert.equal(providerConcurrency({ provider: 'llm', llmConcurrency: 6 }), 6);
  assert.equal(providerConcurrency({ provider: 'google' }), 3);
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
  plugin.settings = {
    deeplKey: 'deep-secret', llmKey: 'llm-secret', deepseekKey: 'ds-secret',
    openaiKey: 'openai-secret', claudeKey: 'claude-secret', provider: 'deepseek',
  };
  plugin.saveData = async data => { persisted = data; };

  await plugin.loadSecrets({
    deeplKey: 'deep-secret', llmKey: 'llm-secret', deepseekKey: 'ds-secret',
    openaiKey: 'openai-secret', claudeKey: 'claude-secret', provider: 'deepseek',
  });

  assert.equal(secrets.get('quick-zh-deepl-key'), 'deep-secret');
  assert.equal(secrets.get('quick-zh-llm-key'), 'llm-secret');
  assert.equal(secrets.get('quick-zh-deepseek-key'), 'ds-secret');
  assert.equal(secrets.get('quick-zh-openai-key'), 'openai-secret');
  assert.equal(secrets.get('quick-zh-claude-key'), 'claude-secret');
  assert.equal('deeplKey' in persisted, false);
  assert.equal('llmKey' in persisted, false);
  assert.equal('deepseekKey' in persisted, false);
  assert.equal('openaiKey' in persisted, false);
  assert.equal('claudeKey' in persisted, false);
});

test('withRetry backs off for retryable DeepSeek failures and then succeeds', async () => {
  const delays = [];
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error('busy'), { status: calls === 1 ? 429 : 503 });
    return 'ok';
  }, { retries: 3, baseDelay: 10, sleep: async ms => delays.push(ms) });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test('withRetry does not retry authentication or balance failures', async () => {
  let calls = 0;
  await assert.rejects(() => withRetry(async () => {
    calls++;
    throw Object.assign(new Error('bad key'), { status: 401 });
  }, { sleep: async () => {} }), /bad key/);
  assert.equal(calls, 1);
});

test('Google shares one queue across long chunks, links and code boundaries', async t => {
  const started = [];
  const finished = [];
  let active = 0;
  let peak = 0;
  onRequest = async ({ url }) => {
    const part = new URL(url).searchParams.get('q');
    started.push(part);
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, started.length === 1 ? 20 : 1));
    finished.push(part);
    active--;
  };
  t.after(() => { onRequest = undefined; });
  const a = 'a'.repeat(1200);
  const b = 'b'.repeat(300);
  const tail = '\n\n[Docs](https://example.org)\n\n```js\ncode\n```\n\nDocs\n\n$$x\n\ny$$';
  const result = await translateBody(a + b + tail, { provider: 'google', targetLang: 'zh-CN', googleConcurrency: 2 });
  assert.equal(result, a + '\n\n' + b + tail);
  assert.deepEqual(started, [a, b, 'Docs']);
  assert.equal(peak, 2);
  assert.notEqual(finished[0], a);
});

test('a failed queue stops dispatch and drains active requests before returning', async () => {
  const started = [];
  const finished = [];
  await assert.rejects(mapConcurrent([0, 1, 2, 3], 2, async index => {
    started.push(index);
    if (!index) throw new Error('denied');
    await new Promise(resolve => setTimeout(resolve, 5));
    finished.push(index);
  }), /denied/);
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(finished, [1]);
});

test('OpenAI sends a compatible GPT-5 mini request and rejects missing keys locally', async () => {
  capturedRequests.length = 0;
  const settings = { provider: 'openai', openaiModel: 'gpt-5-mini' };
  await assert.rejects(translateBody('Hello', settings), /OpenAI API Key/);
  assert.equal(capturedRequests.length, 0);
  await translateBody('Hello', { ...settings, openaiKey: 'test' });
  const request = JSON.parse(capturedRequests[0].body);
  assert.equal(request.model, 'gpt-5-mini');
  assert.equal('temperature' in request, false);
});

test('subscription batches cap item count and aggregate size, retaining order', () => {
  const texts = [...Array(33).fill('one'), 'a'.repeat(6000), 'b'.repeat(6000)];
  const batches = QuickZh._test.subscriptionBatches(texts);
  assert.deepEqual(batches.map(batch => batch.length), [32, 2, 1]);
  assert.deepEqual(batches.flat(), texts);
});

test('subscription results match source IDs and reject incomplete or ambiguous output', () => {
  const { subscriptionResults } = QuickZh._test;
  const first = { id: 0, text: '甲' }, second = { id: 1, text: '乙' };
  const format = translations => JSON.stringify({ translations });
  assert.deepEqual(subscriptionResults(format([second, first]), 2), ['甲', '乙']);
  for (const rows of [[first], [first, first], [first, { id: 2, text: '乙' }], [first, { id: 1, text: ' ' }]]) {
    assert.throws(() => subscriptionResults(format(rows), 2), /不完整/);
  }
});

test('title and description share the note queue and unrelated metadata stays local', async () => {
  capturedRequests.length = 0;
  const fm = '---\ntitle: "Title"\ndescription: "Body"\nsource: private\n---';
  const out = await QuickZh._test.translateNote(fm, 'Body', 'Original', { provider: 'google', targetLang: 'zh-CN', translateFilename: true });
  assert.deepEqual(out, { fm, body: 'Body', title: 'Title' });
  assert.deepEqual(capturedRequests.map(r => new URL(r.url).searchParams.get('q')), ['Title', 'Body']);
});
