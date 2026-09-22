# Quick Chinese Translate

One click translates the **whole current note into Simplified Chinese** and saves it as a new copy. No language picker, no copy-paste.

It's built for one job: *"I clipped a foreign-language article and I just want a clean, offline-readable Chinese version."*

## Features

- **Whole-note translation** — click the ribbon icon (译) or run the command `翻译当前笔记 → 中文`.
- **Title is translated too** — the translated Chinese title becomes the new filename (which is the big title shown at the top of an Obsidian note); `title` / `description` in the frontmatter are translated as well.
- **Frontmatter is preserved** — only the values of `title`/`description` are translated and safely quoted; all other properties (`source`, `date`, `tags`, `category`, …) are kept verbatim, so the YAML never breaks.
- **Code blocks are kept untouched** — fenced ``` code / prompts are never sent to the translator.
- **Original is kept** — a new file is created; the source note is never modified. Machine translation is lossy, so the original stays as the source of truth.
- **Multiple engines** — Google, DeepL, DeepSeek, OpenAI, Claude, or any custom OpenAI-compatible endpoint.
- **Safe repeated runs** — existing translated notes are never overwritten; a numbered copy is created instead.
- **Faster LLM translation** — choose 1–6 concurrent chunks for long notes (default: 2).
- **First-class AI providers** — DeepSeek, OpenAI, and Claude each have their own key, model, and concurrency controls; all use automatic backoff for temporary failures.

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
  - **DeepSeek**(使用自己的 API Key，内置官方接口与模型预设，限流时自动退避重试)
  - **OpenAI**(使用自己的 API Key，内置官方接口与模型预设)
  - **Claude**(使用自己的 API Key，适配官方 Messages API)
  - **自定义兼容接口**(任意 OpenAI 兼容服务)
- 🛡️ **重复翻译不覆盖**:目标文件已存在时自动生成带序号的新副本，不覆盖已有译文。
- ⚡ **AI 长文并发**:DeepSeek / OpenAI / Claude / 自定义兼容接口均可设置 1–6 个分段并发，默认 2。
- 🚀 **DeepSeek 专项适配**:可选 Flash / V4 Pro，默认关闭思考以提高翻译速度；429 或临时服务错误会自动退避重试。

## 用法

1. 打开任意笔记。
2. 点左侧栏的「译」图标(或命令面板搜「翻译当前笔记」)。
3. 自动生成中文副本并打开。

切换引擎 / 填 Key:**设置 → 一键中文翻译**。默认 Google,开箱即用。

## 安装

### 手动安装

把 `main.js`、`manifest.json` 放到你的库的 `.obsidian/plugins/quick-zh/` 目录下,然后在 设置 → 第三方插件 里启用。

## 隐私

- Google / DeepL / DeepSeek / OpenAI / Claude / 自定义接口都会把待翻译文本发到所选服务商。请按需选择，敏感内容建议使用可信的自建接口。
- 在支持 SecretStorage 的新版 Obsidian 中，API Key 会存入安全密钥存储；旧版 Obsidian 会继续使用插件本地配置以保持兼容。
- 插件不收集任何数据,所有请求由 Obsidian 直接发出。

## License

MIT
