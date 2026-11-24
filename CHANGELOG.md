# Changelog

## 0.7.1

- Save completed subscription batches locally. Run the translation command on the same source note to resume after a timeout or restart.
- Show completed fragments, active batches and a cooldown countdown. On a temporary Codex rate limit, wait outside the translation timeout and retry the affected batch once with reduced concurrency.

## 0.7.0

- Add ChatGPT subscription translation on macOS through the signed-in Codex CLI, with structured batches and up to two batches in flight.

- Translate independent body fragments through one bounded queue per note and reuse identical fragments. Google defaults to three workers and retries temporary failures.
- Support GPT-5 mini’s request parameters and show setup instructions when OpenAI or DeepL credentials are missing.

## 0.6.0 — 2026-09-22

- Add a dedicated DeepSeek provider using the official API endpoint and user-supplied API key.
- Store the DeepSeek key in Obsidian SecretStorage.
- Add DeepSeek model and concurrency controls with a safe default of two concurrent chunks.
- Retry rate-limit and temporary server failures with bounded exponential backoff.
- Add regression tests for retry behavior and DeepSeek secret migration.
- Add dedicated OpenAI and Claude providers with separate API keys, model presets, concurrency controls, and retry handling.
- Remove the unverified custom-compatible option from the settings menu while retaining legacy configuration compatibility.
- Rewrite the product description, provider guide, and privacy documentation to match the supported feature set.

## 0.5.1

- Preserve inline and display LaTeX math during translation, including `$...$`, `$$...$$`, `\\(...\\)`, and `\\[...\\]` forms.
- Preserve math expressions used inside Markdown link labels.
- Add regression tests that simulate an LLM altering math delimiters and TeX commands.

## 0.5.0

- Translate the filename even when a note has no `title` property.
- Create a numbered copy instead of overwriting an existing translation.
- Split very long paragraphs so provider request limits are respected.
- Preserve Markdown spacing around fenced code blocks across translation providers.
- Protect Markdown link destinations and bare URLs from translation-provider changes.
- Add configurable LLM translation concurrency from 1 to 6, defaulting to 2.
- Store API keys in Obsidian SecretStorage when available and migrate existing keys automatically.
- Mask API keys in the settings interface and add regression tests for core helpers.

## 0.4.0

- Initial public release.
