# Quick Chinese Translate

One click translates the **whole current note into Simplified Chinese** and saves it as a new copy. No language picker, no copy-paste.

It's built for one job: *"I clipped a foreign-language article and I just want a clean, offline-readable Chinese version."*

## Features

- **Whole-note translation** — click the ribbon icon (译) or run the command `翻译当前笔记 → 中文`.
- **Title is translated too** — the translated Chinese title becomes the new filename (which is the big title shown at the top of an Obsidian note); `title` / `description` in the frontmatter are translated as well.
- **Frontmatter is preserved** — only the values of `title`/`description` are translated and safely quoted; all other properties (`source`, `date`, `tags`, `category`, …) are kept verbatim, so the YAML never breaks.
- **Code blocks are kept untouched** — fenced ``` code / prompts are never sent to the translator.
- **Original is kept** — a new file is created; the source note is never modified. Machine translation is lossy, so the original stays as the source of truth.
- **Multiple engines** — Google (free, default, no config), DeepL (API key), or any OpenAI-compatible LLM endpoint (best quality, preserves Markdown).

## Installation

### Manual

Copy `main.js` and `manifest.json` into your vault's `.obsidian/plugins/quick-zh/` folder, then enable the plugin in **Settings → Community plugins**.

### BRAT (beta)

Add the repository `sany2ng0226-boop/quick-zh` in the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.

## Usage

1. Open any note.
2. Click the **译** ribbon icon (or run *Translate current note → Chinese* from the command palette).
3. A Chinese copy is generated and opened automatically.

Switch engine / enter API keys in **Settings → Quick Chinese Translate**. Google works out of the box.

---

## 中文说明

一键把当前笔记**整篇翻译成简体中文**,生成一个中文副本。无需选语言、无需复制粘贴。

## 为什么做这个

市面上的翻译插件大多是**选中文字翻译**或**双语对照**,而且经常会:

- 不翻笔记标题(Obsidian 里标题 = 文件名);
- 把 YAML 笔记属性(frontmatter)搞坏;
- 把代码块、Prompt 也一起翻坏。

这个插件专门解决"**剪藏的外文文章,我想要一份干净的、能离线读的中文版**"这个场景。

## 功能

- 📄 **整篇翻译**:点左侧栏「译」图标,或运行命令 `翻译当前笔记 → 中文`。
- 🏷️ **标题也翻**:翻译后的中文标题直接作为新文件名(= Obsidian 顶部大标题);frontmatter 里的 `title` / `description` 也翻。
- 🔒 **不破坏笔记属性**:只翻 `title`/`description` 的值并用合法引号包裹,`source`/`date`/`tags`/`category` 等其它属性原样保留,YAML 结构不破。
- 🧩 **代码块原样保留**:` ``` ` 围起来的代码 / Prompt 不翻,保证技术内容不被机翻弄乱。
- 🔁 **保留原件**:生成的是新文件,原文不动(翻译有损,原文是 ground truth)。标题本就是中文的笔记会自动加 ` (中文)` 后缀,不覆盖原文。
- 🌐 **多引擎可选**:
  - **Google**(默认,免费,免配置)
  - **DeepL**(填 API Key,支持 Free / Pro)
  - **LLM**(任意 OpenAI 兼容接口,质量最好,且会保留 Markdown 结构)

## 用法

1. 打开任意笔记。
2. 点左侧栏的「译」图标(或命令面板搜「翻译当前笔记」)。
3. 自动生成中文副本并打开。

切换引擎 / 填 Key:**设置 → 一键中文翻译**。默认 Google,开箱即用。

## 安装

### 手动安装

把 `main.js`、`manifest.json` 放到你的库的 `.obsidian/plugins/quick-zh/` 目录下,然后在 设置 → 第三方插件 里启用。

## 隐私

- Google / DeepL / LLM 引擎都是把待翻译文本发到对应服务商。请按需选择,敏感内容建议用自建 LLM 接口。
- 插件不收集任何数据,所有请求由 Obsidian 直接发出。

## License

MIT
