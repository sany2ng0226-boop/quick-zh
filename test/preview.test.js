const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

class Element {
  constructor(options = {}) {
    this.children = [];
    this.style = {};
    this.textContent = options.text || '';
    this.className = options.cls || '';
  }
  get childElementCount() { return this.children.length; }
  empty() { this.children = []; this.textContent = ''; }
  setText(text) { this.empty(); this.textContent = text; }
  addClass(cls) { this.className += ' ' + cls; }
  createEl(tag, options) {
    const child = new Element(options);
    this.children.push(child);
    return child;
  }
  createDiv(options) { return this.createEl('div', options); }
}

class TFile {
  constructor(name) { this.basename = name; this.path = name + '.md'; }
}
class ItemView {
  constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.contentEl = new Element(); }
  async setState() {}
}
const originalLoad = Module._load;
let QuickZh;
try {
  Module._load = function (request, ...args) {
    if (request === 'obsidian') return {
      Plugin: class {}, ItemView, TFile, PluginSettingTab: class {}, addIcon() {},
      MarkdownRenderer: { render: async (_, text, section) => section.setText(text) },
    };
    return originalLoad.call(this, request, ...args);
  };
  QuickZh = require('../main.js');
} finally {
  Module._load = originalLoad;
}

async function fixture() {
  const plugin = new QuickZh();
  const source = new TFile('Source');
  const output = new TFile('中文');
  const files = new Map([source, output].map(file => [file.path, file]));
  const sourceLeaf = { view: { file: source } };
  let factory;
  const leaves = [];
  const opened = [];
  const workspace = {
    activeLeaf: sourceLeaf,
    setActiveLeaf(leaf) { this.activeLeaf = leaf; },
    getLeaf() {
      const leaf = {
        app: plugin.app,
        async setViewState(state) {
          assert.equal(state.type, 'quick-zh-preview');
          assert.equal(state.active, false);
          this.view = factory(this);
          await this.view.onOpen();
          await this.view.setState(state.state, {});
        },
        async openFile(file) { opened.push(file); },
      };
      leaves.push(leaf);
      return leaf;
    },
  };
  plugin.app = { workspace, vault: { getAbstractFileByPath: filePath => files.get(filePath) } };
  plugin.loadData = async () => ({});
  plugin.registerView = (type, callback) => { assert.equal(type, 'quick-zh-preview'); factory = callback; };
  plugin.addRibbonIcon = plugin.addCommand = plugin.addSettingTab = () => {};
  await plugin.onload();
  const session = plugin.previewSession(source, new AbortController().signal);
  return { session, workspace, source, output, leaves, opened };
}

test('preview appends to the same reading surface and opens the saved copy only on request', async () => {
  const { session, workspace, output, leaves, opened } = await fixture();
  await session.append('第一段', '中文标题');
  const { view } = leaves[0];
  assert.equal(workspace.activeLeaf, leaves[0]);
  assert.equal(view.heading.textContent, '中文标题');
  assert.equal(view.body.className, 'quick-zh-preview-body');
  const first = view.body.children[0];
  view.contentEl.scrollTop = 220;
  const other = { view: { file: new TFile('Other') } };
  workspace.setActiveLeaf(other);
  await session.append('第二段', '中文标题');
  assert.equal(session.complete(output), true);
  assert.equal(workspace.activeLeaf, other);
  assert.equal(view.contentEl.scrollTop, 220);
  assert.equal(view.body.children[0], first);
  assert.deepEqual(view.body.children.map(el => el.textContent), ['第一段', '第二段']);
  assert.deepEqual(opened, []);
  const button = view.footer.children.at(-1);
  assert.equal(button.textContent, '打开正式译文');
  await button.onclick();
  assert.deepEqual(opened, [output]);
});

test('failure preserves translated paragraphs and offers the original note for resuming', async () => {
  const { session, source, leaves, opened } = await fixture();
  await session.append('已经译好的段落', '中文标题');
  session.pause();
  const { view } = leaves[0];
  assert.equal(view.body.children[0].textContent, '已经译好的段落');
  await view.footer.children.at(-1).onclick();
  assert.deepEqual(opened, [source]);
});

test('closing the preview suppresses reopening on later batches and completion', async () => {
  const { session, workspace, output, leaves } = await fixture();
  const originalLeaf = workspace.activeLeaf;
  await session.append('第一段', '');
  const { view } = leaves[0];
  await view.onClose();
  workspace.setActiveLeaf(originalLeaf);
  await session.append('第二段', '');
  assert.equal(session.complete(output), true);
  assert.equal(leaves.length, 1);
  assert.equal(view.body.childElementCount, 1);
  assert.equal(workspace.activeLeaf, originalLeaf);
});

test('switching notes before the first batch suppresses automatic opening', async () => {
  const { session, workspace, output, leaves } = await fixture();
  const originalLeaf = workspace.activeLeaf;
  workspace.setActiveLeaf({ view: { file: new TFile('Other') } });
  await session.append('第一段', '');
  workspace.setActiveLeaf(originalLeaf);
  await session.append('第二段', '');
  assert.equal(session.complete(output), true);
  assert.equal(leaves.length, 0);
  assert.equal(workspace.activeLeaf, originalLeaf);
});
