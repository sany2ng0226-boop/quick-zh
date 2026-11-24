# Quick Chinese Translate

[English](#quick-chinese-translate) · [中文](#中文说明)

Translate an entire Obsidian note into Simplified Chinese with one click. Quick Chinese Translate creates a new Chinese copy while keeping the original note untouched and protecting the Markdown structures that should not be translated.

Built for clipped articles, research notes, technical writing, and any other foreign-language note you want to keep as a clean, offline-readable Chinese copy.

## Why Quick Chinese Translate?

Reading foreign-language sources should not interrupt your note-taking workflow. Quick Chinese Translate brings full-note translation into Obsidian, so you can turn a clipped article or technical document into a reusable Chinese note without copying text into another app or rebuilding its formatting.

The plugin focuses on a practical distinction: translate the content, preserve the structure. It creates a separate translated copy, keeps the source available for comparison, and protects code, links, formulas, and note metadata. Translation runs through the provider you choose; the plugin does not operate a translation relay server.

Quick Chinese Translate is open source under the MIT license and is available in the official Obsidian Community Plugins directory.

## What it does

- Translates the complete note instead of only selected text.
- Translates the note title and uses it as the new filename.
- Translates `title` and `description` in frontmatter while preserving all other properties.
- Keeps fenced code blocks unchanged and never sends them to the translation provider.
- Preserves Markdown link destinations, bare URLs, and LaTeX math.
- Keeps paragraph order stable when long notes are translated concurrently.
- Creates a numbered copy when the translated filename already exists—nothing is overwritten.
- Leaves the source note untouched as the original reference.

## Translation providers

| Provider | Setup | Notes |
| --- | --- | --- |
| Google | None | Free default for quick, convenient translation |
| DeepL | Your DeepL API key | Supports DeepL Free and Pro endpoints |
| DeepSeek | Your DeepSeek API key | Official endpoint, model presets, non-thinking translation, and retry handling |
| ChatGPT subscription (macOS) | Codex CLI signed in with ChatGPT | Up to 32 fragments per batch, two batches at a time, uses Codex plan limits |
| OpenAI | Your OpenAI API key | Official endpoint and model presets |
| Claude | Your Anthropic API key | Official Claude Messages API and model presets |

Google translates up to 3 chunks per note concurrently by default (adjustable from 1 to 4). Identical body fragments share one request within a note.

DeepSeek, OpenAI, and Claude support 1–6 concurrent translation chunks for long notes. The default is 2. Temporary rate-limit and server failures use bounded exponential backoff, while authentication errors fail immediately.

Every API-based provider uses the current user's own key. The plugin does not include a shared key, proxy requests through the plugin author, or pay provider charges on the user's behalf.

## Usage

1. Open the note you want to translate.
2. Click the **译** ribbon icon, or run **翻译当前笔记 → 中文** from the command palette.
3. The translated copy is created and opened automatically.

For subscription translation on macOS, install a recent Codex CLI, run `codex login`, and choose **ChatGPT 订阅（Codex）** in plugin settings. The CLI uses the model supplied by Codex.

The progress notice counts completed fragments. If Codex reports a temporary rate limit, the notice counts down, then the plugin retries the affected batch once and runs the remaining queue one batch at a time. Waiting does not use the three-minute translation timeout. To continue an interrupted translation, open the same source note and translate again. Completed batches survive an Obsidian restart. Changing the translatable input starts a fresh translation.

Completed batches are stored on this Mac under `~/Library/Application Support/obsidian/quick-zh/checkpoints/`. Saving the translated note clears the checkpoints for that translation.

Choose an API provider and enter its key under **Settings → Quick Chinese Translate**. Google is selected by default and requires no configuration.

## Installation

### Obsidian Community Plugins

1. Open **Settings → Community plugins → Browse** in Obsidian.
2. Search for **Quick Chinese Translate**.
3. Select **Install**, then **Enable**.

You can also [open the plugin listing in Obsidian](obsidian://show-plugin?id=quick-zh).

### Manual installation

Copy `main.js` and `manifest.json` into your vault's `.obsidian/plugins/quick-zh/` directory, then enable **Quick Chinese Translate** under **Settings → Community plugins**.

### BRAT

Add `sany2ng0226-boop/quick-zh` to [BRAT](https://github.com/TfTHacker/obsidian42-brat).

## Privacy and API keys

- Translation text goes to the selected provider. Subscription mode passes the selected note’s translatable fragments to the local Codex CLI over stdin for processing by OpenAI.
- API keys belong to each user and are never bundled with the plugin or published in the repository.
- On supported Obsidian versions, keys are stored in local SecretStorage and shown as masked fields in settings.
- The plugin does not collect analytics or relay translation content through its own server.
- Avoid sending sensitive notes to third-party translation services unless their privacy terms meet your needs.

---

## 中文说明

Quick Chinese Translate 是一个面向 Obsidian 的整篇笔记中文翻译插件。点击一次，即可生成一份简体中文副本；原文保持不动，Markdown、笔记属性和技术内容得到针对性保护。

它适合剪藏文章、研究资料、技术文档，以及任何希望保存为干净、可离线阅读中文版的外文笔记。

## 它能做什么

- 翻译整篇笔记，不需要手动选择文字或复制粘贴。
- 翻译笔记标题，并将中文标题作为新文件名。
- 翻译 frontmatter 中的 `title` 和 `description`，其余属性保持原样。
- 围栏代码块保持不变，并且不会发送给翻译服务商。
- 保护 Markdown 链接地址、裸 URL 和 LaTeX 公式。
- 长文并发翻译后仍按原文顺序组装，不打乱段落。
- 目标文件已存在时自动创建带序号的新副本，不覆盖已有笔记。
- 原始笔记始终保留，作为可靠的原文依据。

## 翻译服务商

| 服务商 | 配置 | 说明 |
| --- | --- | --- |
| Google | 无需配置 | 默认免费模式，开箱即用 |
| DeepL | 用户自己的 DeepL API Key | 支持 Free 和 Pro 接口 |
| DeepSeek | 用户自己的 DeepSeek API Key | 官方接口、模型预设、非思考翻译和自动重试 |
| ChatGPT 订阅（macOS） | 本机 Codex CLI 使用 ChatGPT 登录 | 每批最多 32 个片段，同时最多 2 批，消耗 Codex 订阅额度 |
| OpenAI | 用户自己的 OpenAI API Key | 官方接口和模型预设 |
| Claude | 用户自己的 Anthropic API Key | 官方 Messages API 和模型预设 |

Google 默认每篇笔记并发翻译 3 个分段，可调为 1–4。同一篇正文里完全相同的片段只请求一次。

DeepSeek、OpenAI 和 Claude 支持 1–6 个长文分段并发，默认并发数为 2。遇到限流或临时服务器错误时会进行有限次数的指数退避重试；Key 错误等认证问题不会反复请求。

所有需要 API 的服务商都使用当前用户自己的 Key。插件不提供共享 Key，不通过作者的服务器转发请求，也不承担用户的 API 费用。

## 使用方法

1. 打开需要翻译的笔记。
2. 点击左侧栏的 **译** 图标，或在命令面板运行 **翻译当前笔记 → 中文**。
3. 插件会自动生成并打开中文副本。

在 Mac 上使用订阅时，安装新版 Codex CLI，运行 `codex login` 并使用 ChatGPT 登录，然后在插件设置里选择 **ChatGPT 订阅（Codex）**。模型由 Codex 选择。

进度提示显示已译片段数。遇到临时限流会显示倒计时，到期后自动重试受影响的批次一次，后续改为一次翻一批。等待时间单独计时，每次翻译仍有三分钟。如果中断，重开同一篇原文，再点「译」即可接着翻。重启 Obsidian 后仍可续翻；修改待译内容会开始一轮新翻译。

已完成批次暂存在本机 `~/Library/Application Support/obsidian/quick-zh/checkpoints/`，译文成功保存后会清理本次翻译的断点。

使用 API 引擎时，在 **设置 → Quick Chinese Translate** 中选择服务商并填写对应 Key。默认使用 Google，无需配置。

## 安装

### Obsidian 社区插件市场

1. 打开 Obsidian 的 **设置 → 第三方插件 → 浏览**。
2. 搜索 **Quick Chinese Translate**。
3. 点击 **安装**，然后 **启用**。

也可以[在 Obsidian 中打开插件页面](obsidian://show-plugin?id=quick-zh)。

### 手动安装

将 `main.js` 和 `manifest.json` 放入库目录下的 `.obsidian/plugins/quick-zh/`，然后前往 **设置 → 第三方插件** 启用 **Quick Chinese Translate**。

### BRAT

在 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 中添加仓库 `sany2ng0226-boop/quick-zh`。

## 隐私与 API Key

- 待翻译文本发送给所选服务商。订阅模式通过标准输入把当前笔记需要翻译的片段交给本机 Codex CLI，由 OpenAI 处理。
- API Key 属于各个用户，不会内置在插件中，也不会上传到公开仓库。
- 在支持的 Obsidian 版本中，Key 保存在本机 SecretStorage，并在设置页中以密码形式遮挡。
- 插件不收集分析数据，也不会通过自己的服务器中转翻译内容。
- 如果笔记包含敏感信息，请先确认所选服务商的隐私条款符合你的需求。

## License

MIT
