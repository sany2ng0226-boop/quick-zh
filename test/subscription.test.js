const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PassThrough, Writable } = require('node:stream');
const Module = require('node:module');
const childProcess = require('node:child_process');
const test = require('node:test');

const notices = [];
class Notice {
  constructor(message) { this.setMessage(message); }
  setMessage(message) { notices.push(message); return this; }
  hide() {}
}
class TFile {
  constructor(filePath) {
    this.path = filePath;
    this.basename = path.basename(filePath, '.md');
    this.parent = { path: path.dirname(filePath) };
  }
}
const originalLoad = Module._load;
let QuickZh;
try {
  Module._load = function (id, ...args) {
    if (id === 'obsidian') return {
      Platform: { isDesktopApp: true, isMacOS: true },
      Plugin: class {},
      PluginSettingTab: class {},
      Notice, TFile, addIcon() {},
    };
    return originalLoad.call(this, id, ...args);
  };
  QuickZh = require('../main.js');
} finally {
  Module._load = originalLoad;
}

async function fixture(t, count = 65) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quick-zh-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.mock.method(os, 'homedir', () => root);
  const source = new TFile('Clips/source.md');
  const paragraphs = Array.from({ length: count }, (_, i) => 'Paragraph ' + i);
  const files = new Map([[source.path, paragraphs.join('\n\n')]]);
  const vault = {
    configDir: '.obsidian',
    getName: () => path.basename(root),
    adapter: { getBasePath: () => root },
    read: async file => files.get(file.path),
    create: async (name, content) => {
      assert.ok(!files.has(name), 'source and previous translations must survive');
      files.set(name, content);
      return new TFile(name);
    },
    getAbstractFileByPath: name => files.has(name) ? new TFile(name) : null,
  };
  const workspace = { getActiveFile: () => source, getLeaf: () => ({ openFile: async () => {} }) };
  function plugin() {
    const instance = new QuickZh();
    instance.app = { vault, workspace };
    instance.manifest = { id: 'quick-zh', dir: '.obsidian/plugins/quick-zh' };
    instance.settings = { provider: 'subscription', translateFilename: false };
    return instance;
  }
  notices.length = 0;
  return { root, paragraphs, files, plugin, source, vault };
}

function mockCodex(t, complete) {
  const requests = [];
  t.mock.method(childProcess, 'execFile', (binary, args, options, callback) => {
    assert.equal(binary, 'codex');
    const child = new EventEmitter();
    child.stderr = new PassThrough();
    child.stdout = new PassThrough();
    child.kill = signal => {
      child.killed = true;
      setImmediate(() => callback(Object.assign(new Error('Codex stopped'), { killed: true, signal }), '', ''));
      return true;
    };
    let body = '';
    child.stdin = new Writable({
      write(chunk, _, next) { body += chunk; next(); },
      final(next) {
        next();
        if (args.includes('status')) {
          setImmediate(() => callback(null, 'Logged in using ChatGPT', ''));
          return;
        }
        const rows = JSON.parse(body);
        const texts = rows.map(row => row.text);
        requests.push(texts);
        const respond = (err) => {
          if (err) callback(err, '', '');
          else callback(null, JSON.stringify({ translations: rows.map(row => ({ id: row.id, text: '翻译 ' + row.text })) }), '');
        };
        setImmediate(() => complete(texts, respond, child));
      },
    });
    return child;
  });
  return requests;
}

const timeout = () => Object.assign(new Error('Timed out'), { killed: true, signal: 'SIGTERM' });

test('opening paragraphs arrive early and later batches append in order across a gap', async t => {
  const { paragraphs, root } = await fixture(t, 54);
  const deltas = [];
  const body = ['A [site](https://example.org).', 'Date', ...paragraphs].join('\n\n');
  let waiting;
  const requests = mockCodex(t, (texts, respond) => {
    if (texts[0] === paragraphs[1]) { waiting = respond; return; }
    respond();
    if (waiting && texts.includes(paragraphs.at(-1))) {
      assert.equal(deltas.length, 1, 'later results are held until all earlier paragraphs are ready');
      waiting();
    }
  });
  const value = await QuickZh._test.translateNote('---\ntitle: Title\n---', body, '', {provider:'subscription'}, {
    vaultPath: root, filePath: 'source.md',
    onPreview(delta, title) { assert.equal(title, '翻译 Title'); deltas.push(delta); },
  });
  assert.deepEqual(requests[0], ['Title','A','site','Date',paragraphs[0]]);
  assert.match(deltas[0], /\[翻译 site\]\(https:\/\/example.org\)/);
  assert.ok(deltas[0].trimEnd().endsWith('翻译 Paragraph 0'));
  assert.ok(deltas.length >= 2);
  assert.equal(deltas.join(''), value.body);
});

test('a progressive run reads checkpoints saved with the previous batch layout', async t => {
  const { paragraphs, root } = await fixture(t);
  const body = paragraphs.join('\n\n'), settings = {provider:'subscription'};
  const ctx = {filePath:'source.md', vaultPath:root};
  let fail = true;
  const requests = mockCodex(t, (texts, respond) => respond(fail && texts.length === 1 ? timeout() : null));
  await assert.rejects(QuickZh._test.translateNote('', body, '', settings, ctx), /超时/);
  requests.length = 0;
  fail = false;
  const previews = [];
  const result = await QuickZh._test.translateNote('', body, '', settings, {
    ...ctx, onPreview(delta) { previews.push(delta); },
  });
  assert.deepEqual(requests, [[paragraphs.at(-1)]]);
  assert.equal(previews.join(''), result.body);
});

test('after the last batch times out, a new plugin instance sends only the remaining fragment', async t => {
  const { plugin, paragraphs, files } = await fixture(t);
  let failTail = true;
  const requests = mockCodex(t, (texts, respond) => {
    if (texts.length === 1 && failTail) respond(timeout());
    else respond();
  });
  t.mock.method(console, 'error', () => {});
  await plugin().run();
  assert.equal(files.size, 1);
  assert.equal(requests.flat().filter(text => text !== paragraphs.at(-1)).length, 64);
  assert.ok(notices.some(message => /64\s*\/\s*65/.test(message)), 'checkpoint count is visible even when the final batch fails');

  requests.length = 0;
  notices.length = 0;
  failTail = false;
  await plugin().run();
  assert.deepEqual(requests, [[paragraphs.at(-1)]]);
  assert.ok(notices.some(message => /64\s*\/\s*65/.test(message)), 'the restored count is visible before the retry');
  assert.ok(notices.some(message => /65\s*\/\s*65/.test(message)));
  assert.equal(files.get('Clips/source (中文).md'), paragraphs.map(p => '翻译 ' + p).join('\n\n') + '\n');
});

test('an edited source starts fresh and a successfully written copy clears the checkpoint', async t => {
  const { plugin, paragraphs, files, source } = await fixture(t);
  let failTail = true;
  const requests = mockCodex(t, (texts, respond) => {
    respond(failTail && texts.length === 1 ? timeout() : null);
  });
  t.mock.method(console, 'error', () => {});
  await plugin().run();
  paragraphs[32] = 'Changed paragraph';
  files.set(source.path, paragraphs.join('\n\n'));
  failTail = false;
  requests.length = 0;
  await plugin().run();
  assert.deepEqual(requests.flat().sort(), [...paragraphs].sort());
  assert.match(files.get('Clips/source (中文).md'), /翻译 Changed paragraph/);

  requests.length = 0;
  await plugin().run();
  assert.deepEqual(requests.flat().sort(), [...paragraphs].sort());
  assert.equal(files.get('Clips/source (中文) 1.md'), files.get('Clips/source (中文).md'));
});

test('a vault write failure retains the complete checkpoint for a save-only retry', async t => {
  const { plugin, paragraphs, files, vault } = await fixture(t, 3);
  const create = vault.create;
  vault.create = async () => { throw new Error('Vault is temporarily unavailable'); };
  const requests = mockCodex(t, (_, respond) => respond());
  t.mock.method(console, 'error', () => {});
  await plugin().run();
  assert.equal(files.size, 1);

  requests.length = 0;
  vault.create = create;
  await plugin().run();
  assert.deepEqual(requests, []);
  assert.equal(files.get('Clips/source (中文).md'), paragraphs.map(p => '翻译 ' + p).join('\n\n') + '\n');
});

test('Codex rate-limit parser reads its advertised retry time and ignores unrelated diagnostics', () => {
  const parse = QuickZh._test.subscriptionBackoff;
  const warning = '2026-11-24T03:29:54.132610Z WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 163.999879291s)... turn_id=test retries=1 max_retries=5 sampling_error=exceeded retry limit, last status: 429 Too Many Requests';
  assert.ok(Math.abs(parse(warning) - 164000) <= 1);
  assert.equal(parse('HTTP/1.1 429 Too Many Requests'), 30000);
  assert.equal(parse('[{"id":0,"text":"HTTP 429 Too Many Requests"}]'), null);
  assert.equal(parse('WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 1s)... last status: 503 Service Unavailable'), null);
});

test('live 429 pauses new work for the advertised interval, retries the failed batch once and finishes in serial', { timeout: 9000 }, async t => {
  const { plugin, paragraphs, files } = await fixture(t, 97);
  const firstWave = new Map();
  let limitedAt;
  let nextStart;
  let activeAfterLimit = 0;
  let peakAfterLimit = 0;
  const requests = mockCodex(t, (texts, respond, child) => {
    if (limitedAt === undefined) {
      firstWave.set(texts[0], { child, respond });
      if (firstWave.size === 2) {
        limitedAt = performance.now();
        const failed = firstWave.get(paragraphs[0]);
        failed.child.stderr.write('WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 0.12s)... last status: 429 Too Many Requests\n');
        firstWave.get(paragraphs[32]).respond();
      }
      return;
    }
    nextStart ??= performance.now();
    activeAfterLimit++;
    peakAfterLimit = Math.max(peakAfterLimit, activeAfterLimit);
    setImmediate(() => {
      activeAfterLimit--;
      respond();
    });
  });
  await plugin().run();
  assert.ok(nextStart - limitedAt >= 100, 'no new jobs start during backoff');
  assert.equal(peakAfterLimit, 1);
  assert.equal(requests.filter(batch => batch.includes(paragraphs[0])).length, 2);
  assert.equal(requests.filter(batch => batch.includes(paragraphs[32])).length, 1);
  assert.ok(notices.some(message => /限流|429/.test(message)));
  assert.equal(files.get('Clips/source (中文).md'), paragraphs.map(p => '翻译 ' + p).join('\n\n') + '\n');
});

test('repeated rate limits do not retry a batch indefinitely', { timeout: 9000 }, async t => {
  const { plugin, files } = await fixture(t, 1);
  let calls = 0;
  mockCodex(t, (_, respond, child) => {
    calls++;
    if (calls > 2) return respond(new Error('Unexpected extra retry'));
    child.stderr.write('WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 0.01s)... last status: 429 Too Many Requests\n');
  });
  t.mock.method(console, 'error', () => {});
  await plugin().run();
  assert.equal(calls, 2);
  assert.equal(files.size, 1);
  assert.ok(notices.some(message => /限流|429/.test(message)));
});
