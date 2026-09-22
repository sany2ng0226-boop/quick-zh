# Quick Chinese Translate

Translate an entire Obsidian note into Simplified Chinese with one click. Quick Chinese Translate creates a new Chinese copy while keeping the original note untouched and protecting the Markdown structures that should not be translated.

Built for clipped articles, research notes, technical writing, and any other foreign-language note you want to keep as a clean, offline-readable Chinese copy.

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
| OpenAI | Your OpenAI API key | Official endpoint and model presets |
| Claude | Your Anthropic API key | Official Claude Messages API and model presets |

DeepSeek, OpenAI, and Claude support 1–6 concurrent translation chunks for long notes. The default is 2. Temporary rate-limit and server failures use bounded exponential backoff, while authentication errors fail immediately.

Every API-based provider uses the current user's own key. The plugin does not include a shared key, proxy requests through the plugin author, or pay provider charges on the user's behalf.

## Usage

1. Open the note you want to translate.
2. Click the **译** ribbon icon, or run **翻译当前笔记 → 中文** from the command palette.
3. The translated copy is created and opened automatically.

Choose a provider and enter its key under **Settings → Quick Chinese Translate**. Google is selected by default and requires no configuration.

## Installation

### Manual installation

Copy `main.js` and `manifest.json` into your vault's `.obsidian/plugins/quick-zh/` directory, then enable **Quick Chinese Translate** under **Settings → Community plugins**.

### BRAT

Add `sany2ng0226-boop/quick-zh` to [BRAT](https://github.com/TfTHacker/obsidian42-brat).

## Privacy and API keys

- Translation text is sent directly from Obsidian to the provider selected by the user.
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
| OpenAI | 用户自己的 OpenAI API Key | 官方接口和模型预设 |
| Claude | 用户自己的 Anthropic API Key | 官方 Messages API 和模型预设 |

DeepSeek、OpenAI 和 Claude 支持 1–6 个长文分段并发，默认并发数为 2。遇到限流或临时服务器错误时会进行有限次数的指数退避重试；Key 错误等认证问题不会反复请求。

所有需要 API 的服务商都使用当前用户自己的 Key。插件不提供共享 Key，不通过作者的服务器转发请求，也不承担用户的 API 费用。

## 使用方法

1. 打开需要翻译的笔记。
2. 点击左侧栏的 **译** 图标，或在命令面板运行 **翻译当前笔记 → 中文**。
3. 插件会自动生成并打开中文副本。

在 **设置 → Quick Chinese Translate** 中选择服务商并填写对应 Key。默认使用 Google，无需配置。

## 安装

### 手动安装

将 `main.js` 和 `manifest.json` 放入库目录下的 `.obsidian/plugins/quick-zh/`，然后前往 **设置 → 第三方插件** 启用 **Quick Chinese Translate**。

### BRAT

在 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 中添加仓库 `sany2ng0226-boop/quick-zh`。

## 隐私与 API Key

- 待翻译文本由 Obsidian 直接发送给用户选择的服务商。
- API Key 属于各个用户，不会内置在插件中，也不会上传到公开仓库。
- 在支持的 Obsidian 版本中，Key 保存在本机 SecretStorage，并在设置页中以密码形式遮挡。
- 插件不收集分析数据，也不会通过自己的服务器中转翻译内容。
- 如果笔记包含敏感信息，请先确认所选服务商的隐私条款符合你的需求。

## License

MIT
