const { Plugin, Notice, requestUrl, addIcon, TFile, PluginSettingTab, Setting } = require('obsidian');

addIcon('quick-zh-icon', '<text x="50" y="74" font-size="78" text-anchor="middle" fill="currentColor" font-family="sans-serif">译</text>');

const DEFAULTS = {
  provider: 'google',      // google | deepl | deepseek | llm
  targetLang: 'zh-CN',     // google/llm 用；deepl 固定 ZH
  translateFilename: true, // 把文件名也翻成中文（= Obsidian 大标题）
  deeplKey: '',
  deeplPro: false,
  llmEndpoint: 'https://api.openai.com/v1',
  llmKey: '',
  llmModel: 'gpt-4o-mini',
  llmConcurrency: 2,
  deepseekKey: '',
  deepseekModel: 'deepseek-flash',
  deepseekConcurrency: 2,
};

const SECRET_IDS = {
  deeplKey: 'quick-zh-deepl-key',
  llmKey: 'quick-zh-llm-key',
  deepseekKey: 'quick-zh-deepseek-key',
};

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function errorStatus(error) {
  return Number(error && (error.status || error.statusCode || (error.response && error.response.status))) || 0;
}

async function withRetry(operation, options = {}) {
  const retries = Number.isInteger(options.retries) ? options.retries : 3;
  const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : 500;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      const status = errorStatus(error);
      if (attempt >= retries || !RETRYABLE_STATUS.has(status)) throw error;
      await sleep(baseDelay * (2 ** attempt));
      attempt++;
    }
  }
}

// ---- 各家接口：输入纯文本 → 返回中文，失败抛错（好让上层 fallback/提示）----
async function viaGoogle(text, tl) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + tl + '&dt=t&q=' + encodeURIComponent(text);
  const res = await requestUrl({ url, method: 'GET' });
  const data = res.json; let out = '';
  if (Array.isArray(data) && Array.isArray(data[0])) for (const s of data[0]) if (s && s[0]) out += s[0];
  if (!out) throw new Error('Google 返回空');
  return out;
}
async function viaDeepl(text, s) {
  const host = s.deeplPro ? 'https://api.deepl.com' : 'https://api-free.deepl.com';
  const res = await requestUrl({
    url: host + '/v2/translate', method: 'POST',
    headers: { Authorization: 'DeepL-Auth-Key ' + s.deeplKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'target_lang=ZH&text=' + encodeURIComponent(text),
  });
  const t = res.json && res.json.translations && res.json.translations[0];
  if (!t || !t.text) throw new Error('DeepL 返回异常 (' + res.status + ')');
  return t.text;
}
async function viaLlm(text, s) {
  const res = await requestUrl({
    url: s.llmEndpoint.replace(/\/$/, '') + '/chat/completions', method: 'POST',
    headers: { Authorization: 'Bearer ' + s.llmKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: s.llmModel, temperature: 0,
      messages: [
        { role: 'system', content: '你是翻译引擎。把用户内容翻译成简体中文，保留 Markdown 结构（链接、图片、加粗、列表、代码块原样保留），只输出译文，不要解释、不要加引号。' },
        { role: 'user', content: text },
      ],
    }),
  });
  const c = res.json && res.json.choices && res.json.choices[0];
  const out = c && c.message && c.message.content;
  if (!out) throw new Error('LLM 返回异常 (' + res.status + ')');
  return out.trim();
}
async function viaDeepseek(text, s) {
  return withRetry(async () => {
    const res = await requestUrl({
      url: DEEPSEEK_ENDPOINT + '/chat/completions', method: 'POST',
      headers: { Authorization: 'Bearer ' + s.deepseekKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: s.deepseekModel || 'deepseek-flash',
        temperature: 0,
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: '你是翻译引擎。把用户内容翻译成简体中文，保留 Markdown 结构，只输出译文，不要解释、不要加引号。' },
          { role: 'user', content: text },
        ],
      }),
    });
    const choice = res.json && res.json.choices && res.json.choices[0];
    const out = choice && choice.message && choice.message.content;
    if (!out) {
      const error = new Error('DeepSeek 返回异常 (' + res.status + ')');
      error.status = res.status;
      throw error;
    }
    return out.trim();
  });
}
async function translate(text, s) {
  if (!text || !text.trim()) return text;
  if (s.provider === 'deepl') return viaDeepl(text, s);
  if (s.provider === 'deepseek') return viaDeepseek(text, s);
  if (s.provider === 'llm') return viaLlm(text, s);
  return viaGoogle(text, s.targetLang);
}
function maxChunk(s) { return s.provider === 'google' ? 1200 : (s.provider === 'deepl' ? 4000 : 6000); }

function chunk(body, max) {
  const ps = body.split(/\n\n+/).flatMap(p => splitLongText(p, max)); const cs = []; let c = '';
  for (const p of ps) { if (c && (c + '\n\n' + p).length > max) { cs.push(c); c = p; } else c = c ? c + '\n\n' + p : p; }
  if (c) cs.push(c); return cs;
}
function splitLongText(text, max) {
  if (text.length <= max) return [text];
  const out = []; let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < Math.floor(max / 2)) cut = rest.lastIndexOf(' ', max);
    if (cut < Math.floor(max / 2)) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\s+/, '');
  }
  if (rest) out.push(rest);
  return out;
}
function unquote(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}
// 只翻 frontmatter 里 title/description 的值，保持 YAML 结构不破；返回 {fm, title}
async function transFrontmatter(fm, s) {
  const lines = fm.split('\n'); let title = '';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(title|description):\s*(.+)$/);
    if (m) {
      const v = unquote(m[2]);
      if (v) {
        const zh = await translate(v, s);
        lines[i] = m[1] + ': ' + JSON.stringify(zh); // JSON 引号确保合法 YAML
        if (m[1] === 'title') title = zh;
      }
    }
  }
  return { fm: lines.join('\n'), title };
}
function sanitize(name) {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}
async function translatePlainSegment(text, s) {
  if (!text.trim()) return text;
  const configuredConcurrency = s.provider === 'deepseek' ? s.deepseekConcurrency : s.llmConcurrency;
  const concurrency = (s.provider === 'llm' || s.provider === 'deepseek')
    ? Math.max(1, Math.min(6, Number(configuredConcurrency) || 1)) : 1;
  const blocks = text.split(/(\n[ \t]*\n+)/);
  const translated = await mapConcurrent(blocks, concurrency, async block => {
    if (!block.trim() || !/[\p{L}\p{N}]/u.test(block)) return block;
    const leading = (block.match(/^\s*/) || [''])[0];
    const trailing = (block.match(/\s*$/) || [''])[0];
    const core = block.slice(leading.length, block.length - trailing.length);
    const parts = chunk(core, maxChunk(s));
    const output = [];
    for (const part of parts) output.push(await translate(part, s));
    return leading + output.join('\n\n') + trailing;
  });
  return translated.join('');
}
async function translateMarkdownText(text, s) {
  const paragraphs = text.split(/(\n[ \t]*\n+)/);
  if (paragraphs.length > 1) {
    const configuredConcurrency = s.provider === 'deepseek' ? s.deepseekConcurrency : s.llmConcurrency;
    const concurrency = (s.provider === 'llm' || s.provider === 'deepseek')
      ? Math.max(1, Math.min(6, Number(configuredConcurrency) || 1)) : 1;
    const translated = await mapConcurrent(paragraphs, concurrency, paragraph =>
      paragraph.trim() ? translateMarkdownText(paragraph, s) : paragraph);
    return translated.join('');
  }
  // Never send math delimiters or their contents to a translation provider.
  // Prompting an LLM to preserve them is not reliable, and non-LLM providers
  // may alter TeX commands too.
  const pattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?!\$|\s)(?:\\.|[^\\$\n])*(?<![\\\s])\$(?!\$))|(!?)\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"')\],;!?]+)/g;
  const out = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    out.push(await translatePlainSegment(text.slice(cursor, match.index), s));
    if (match[1]) out.push(match[1]);
    else if (match[5]) out.push(match[5]);
    else out.push(`${match[2]}[${await translateMarkdownText(match[3], s)}](${match[4]})`);
    cursor = match.index + match[0].length;
  }
  out.push(await translatePlainSegment(text.slice(cursor), s));
  return out.join('');
}
// 翻正文：```代码块``` 原样保留不翻（prompt/代码不该被机翻碰），其余分段翻
async function translateBody(body, s) {
  const segs = body.split(/(```[\s\S]*?```)/g);
  const out = [];
  for (const seg of segs) {
    if (seg.startsWith('```') || !seg.trim()) { out.push(seg); continue; }
    const leading = (seg.match(/^\s*/) || [''])[0];
    const trailing = (seg.match(/\s*$/) || [''])[0];
    const core = seg.slice(leading.length, seg.length - trailing.length);
    out.push(leading + await translateMarkdownText(core, s) + trailing);
  }
  return out.join('');
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function uniquePath(vault, dir, base) {
  let suffix = 0;
  let path;
  do {
    path = dir + base + (suffix ? ' ' + suffix : '') + '.md';
    suffix++;
  } while (vault.getAbstractFileByPath(path));
  return path;
}

module.exports = class QuickZh extends Plugin {
  async onload() {
    const saved = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULTS, saved);
    await this.loadSecrets(saved);
    this.addRibbonIcon('quick-zh-icon', '翻译当前笔记 → 中文', () => this.run());
    this.addCommand({ id: 'translate-zh', name: '翻译当前笔记 → 中文', callback: () => this.run() });
    this.addSettingTab(new QuickZhSettingTab(this.app, this));
  }
  async loadSecrets(saved) {
    const storage = this.app.secretStorage;
    if (!storage) return;
    let migrated = false;
    for (const key of Object.keys(SECRET_IDS)) {
      const oldValue = saved[key];
      if (oldValue) {
        storage.setSecret(SECRET_IDS[key], oldValue);
        delete saved[key];
        migrated = true;
      }
      this.settings[key] = storage.getSecret(SECRET_IDS[key]) || '';
    }
    if (migrated) await this.saveSettings();
  }
  async saveSettings() {
    const data = Object.assign({}, this.settings);
    const storage = this.app.secretStorage;
    if (storage) {
      for (const key of Object.keys(SECRET_IDS)) {
        storage.setSecret(SECRET_IDS[key], data[key] || '');
        delete data[key];
      }
    }
    await this.saveData(data);
  }
  async run() {
    const s = this.settings;
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice('没有打开的笔记'); return; }
    const raw = await this.app.vault.read(file);
    let fm = '', body = raw;
    if (raw.startsWith('---')) { const e = raw.indexOf('\n---', 3); if (e !== -1) { fm = raw.slice(0, e + 4); body = raw.slice(e + 4).replace(/^\n+/, ''); } }
    const n = new Notice('翻译中…', 0);
    try {
      let fmOut = '', ztitle = '';
      if (fm) { const r = await transFrontmatter(fm, s); fmOut = r.fm + '\n\n'; ztitle = r.title; }
      const zhBody = await translateBody(body, s);
      const zh = fmOut + zhBody + '\n';

      const dir = file.parent && file.parent.path && file.parent.path !== '/' ? file.parent.path + '/' : '';
      if (s.translateFilename && !ztitle) ztitle = await translate(file.basename, s);
      let base = s.translateFilename && sanitize(ztitle) ? sanitize(ztitle) : file.basename + ' (中文)';
      if (dir + base + '.md' === file.path) base += ' (中文)';
      const newPath = uniquePath(this.app.vault, dir, base);

      await this.app.vault.create(newPath, zh);
      n.hide(); new Notice('已生成: ' + newPath.split('/').pop());
      const tf = this.app.vault.getAbstractFileByPath(newPath);
      if (tf instanceof TFile) await this.app.workspace.getLeaf(true).openFile(tf);
    } catch (e) { n.hide(); new Notice('翻译失败 (' + s.provider + '): ' + e.message); console.error('[quick-zh]', e); }
  }
};

class QuickZhSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl: c } = this; c.empty();
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();

    new Setting(c).setName('翻译引擎').setDesc('Google 免费免配置；DeepL/LLM 质量更好，需要 Key')
      .addDropdown(d => d.addOption('google', 'Google（免费）').addOption('deepl', 'DeepL').addOption('deepseek', 'DeepSeek').addOption('llm', 'LLM（OpenAI 兼容）')
        .setValue(s.provider).onChange(v => { s.provider = v; save(); this.display(); }));

    new Setting(c).setName('翻译文件名（= 笔记大标题）').setDesc('开启后生成的中文笔记文件名也用中文标题')
      .addToggle(t => t.setValue(s.translateFilename).onChange(v => { s.translateFilename = v; save(); }));

    if (s.provider === 'google') {
      new Setting(c).setName('目标语言').setDesc('默认 zh-CN 简体中文')
        .addText(t => t.setValue(s.targetLang).onChange(v => { s.targetLang = v.trim() || 'zh-CN'; save(); }));
    }
    if (s.provider === 'deepl') {
      new Setting(c).setName('DeepL API Key').addText(t => { t.inputEl.type = 'password'; t.setValue(s.deeplKey).onChange(v => { s.deeplKey = v.trim(); save(); }); });
      new Setting(c).setName('DeepL Pro 账户').setDesc('付费版打开（用 api.deepl.com）')
        .addToggle(t => t.setValue(s.deeplPro).onChange(v => { s.deeplPro = v; save(); }));
    }
    if (s.provider === 'llm') {
      new Setting(c).setName('Endpoint').setDesc('OpenAI 兼容，如 https://api.openai.com/v1')
        .addText(t => t.setValue(s.llmEndpoint).onChange(v => { s.llmEndpoint = v.trim(); save(); }));
      new Setting(c).setName('API Key').addText(t => { t.inputEl.type = 'password'; t.setValue(s.llmKey).onChange(v => { s.llmKey = v.trim(); save(); }); });
      new Setting(c).setName('模型').addText(t => t.setValue(s.llmModel).onChange(v => { s.llmModel = v.trim(); save(); }));
      new Setting(c).setName('并发数').setDesc('同时翻译的分段数，默认 2，范围 1–6')
        .addSlider(sl => sl.setLimits(1, 6, 1).setDynamicTooltip().setValue(s.llmConcurrency).onChange(v => { s.llmConcurrency = v; save(); }));
    }
    if (s.provider === 'deepseek') {
      new Setting(c).setName('DeepSeek API Key').setDesc('使用你自己的 Key，仅保存在 Obsidian 本机 SecretStorage')
        .addText(t => { t.inputEl.type = 'password'; t.setValue(s.deepseekKey).onChange(v => { s.deepseekKey = v.trim(); save(); }); });
      new Setting(c).setName('DeepSeek 模型').setDesc('翻译默认使用非思考模式，速度更快')
        .addDropdown(d => d.addOption('deepseek-flash', 'DeepSeek Flash').addOption('deepseek-v4-pro', 'DeepSeek V4 Pro')
          .setValue(s.deepseekModel).onChange(v => { s.deepseekModel = v; save(); }));
      new Setting(c).setName('DeepSeek 并发数').setDesc('同时翻译的分段数，默认 2；遇到限流会自动退避重试')
        .addSlider(sl => sl.setLimits(1, 6, 1).setDynamicTooltip().setValue(s.deepseekConcurrency).onChange(v => { s.deepseekConcurrency = v; save(); }));
    }
  }
}

module.exports._test = { chunk, splitLongText, mapConcurrent, sanitize, uniquePath, translateMarkdownText, translateBody, withRetry, errorStatus };
