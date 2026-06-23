const { Plugin, Notice, requestUrl, addIcon, TFile, PluginSettingTab, Setting } = require('obsidian');

addIcon('quick-zh-icon', '<text x="50" y="74" font-size="78" text-anchor="middle" fill="currentColor" font-family="sans-serif">译</text>');

const DEFAULTS = {
  provider: 'google',      // google | deepl | llm
  targetLang: 'zh-CN',     // google/llm 用；deepl 固定 ZH
  translateFilename: true, // 把文件名也翻成中文（= Obsidian 大标题）
  deeplKey: '',
  deeplPro: false,
  llmEndpoint: 'https://api.openai.com/v1',
  llmKey: '',
  llmModel: 'gpt-4o-mini',
};

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
async function translate(text, s) {
  if (!text || !text.trim()) return text;
  if (s.provider === 'deepl') return viaDeepl(text, s);
  if (s.provider === 'llm') return viaLlm(text, s);
  return viaGoogle(text, s.targetLang);
}
function maxChunk(s) { return s.provider === 'google' ? 1200 : (s.provider === 'deepl' ? 4000 : 6000); }

function chunk(body, max) {
  const ps = body.split(/\n\n+/); const cs = []; let c = '';
  for (const p of ps) { if (c && (c + '\n\n' + p).length > max) { cs.push(c); c = p; } else c = c ? c + '\n\n' + p : p; }
  if (c) cs.push(c); return cs;
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
// 翻正文：```代码块``` 原样保留不翻（prompt/代码不该被机翻碰），其余分段翻
async function translateBody(body, s) {
  const segs = body.split(/(```[\s\S]*?```)/g);
  const out = [];
  for (const seg of segs) {
    if (seg.startsWith('```') || !seg.trim()) { out.push(seg); continue; }
    const parts = chunk(seg, maxChunk(s)); const t = [];
    for (const p of parts) t.push(await translate(p, s));
    out.push(t.join('\n\n'));
  }
  return out.join('');
}

module.exports = class QuickZh extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addRibbonIcon('quick-zh-icon', '翻译当前笔记 → 中文', () => this.run());
    this.addCommand({ id: 'translate-zh', name: '翻译当前笔记 → 中文', callback: () => this.run() });
    this.addSettingTab(new QuickZhSettingTab(this.app, this));
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
      let base = (s.translateFilename && ztitle) ? sanitize(ztitle) : file.basename + ' (中文)';
      let newPath = dir + base + '.md';
      if (newPath === file.path) newPath = dir + base + ' (中文).md'; // 别覆盖原文

      const ex = this.app.vault.getAbstractFileByPath(newPath);
      if (ex instanceof TFile) await this.app.vault.modify(ex, zh); else await this.app.vault.create(newPath, zh);
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
    const save = () => this.plugin.saveData(s);

    new Setting(c).setName('翻译引擎').setDesc('Google 免费免配置；DeepL/LLM 质量更好，需要 Key')
      .addDropdown(d => d.addOption('google', 'Google（免费）').addOption('deepl', 'DeepL').addOption('llm', 'LLM（OpenAI 兼容）')
        .setValue(s.provider).onChange(v => { s.provider = v; save(); this.display(); }));

    new Setting(c).setName('翻译文件名（= 笔记大标题）').setDesc('开启后生成的中文笔记文件名也用中文标题')
      .addToggle(t => t.setValue(s.translateFilename).onChange(v => { s.translateFilename = v; save(); }));

    if (s.provider === 'google') {
      new Setting(c).setName('目标语言').setDesc('默认 zh-CN 简体中文')
        .addText(t => t.setValue(s.targetLang).onChange(v => { s.targetLang = v.trim() || 'zh-CN'; save(); }));
    }
    if (s.provider === 'deepl') {
      new Setting(c).setName('DeepL API Key').addText(t => t.setValue(s.deeplKey).onChange(v => { s.deeplKey = v.trim(); save(); }));
      new Setting(c).setName('DeepL Pro 账户').setDesc('付费版打开（用 api.deepl.com）')
        .addToggle(t => t.setValue(s.deeplPro).onChange(v => { s.deeplPro = v; save(); }));
    }
    if (s.provider === 'llm') {
      new Setting(c).setName('Endpoint').setDesc('OpenAI 兼容，如 https://api.openai.com/v1')
        .addText(t => t.setValue(s.llmEndpoint).onChange(v => { s.llmEndpoint = v.trim(); save(); }));
      new Setting(c).setName('API Key').addText(t => t.setValue(s.llmKey).onChange(v => { s.llmKey = v.trim(); save(); }));
      new Setting(c).setName('模型').addText(t => t.setValue(s.llmModel).onChange(v => { s.llmModel = v.trim(); save(); }));
    }
  }
}
