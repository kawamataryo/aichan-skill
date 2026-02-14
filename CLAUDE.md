# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Chan (あいちゃん)** - Amazon Alexa向けの日本語AIスキル。Vercel AI SDKを使用。デプロイ時に環境変数でAIモデル・プロバイダーを設定可能（デフォルト: Gemini 2.5 Flash）。音声による会話・Web検索・会話記憶（S3）機能を持つ。

## Build & Deploy Commands

```bash
# Lambda のビルド・型チェック
cd lambda
npm install
npm run build        # esbuild でバンドル

# SAM によるビルド・デプロイ
make build           # sam build
make deploy          # sam build + sam deploy（環境変数をパラメータとして渡す）
```

テストフレームワークは未導入。

## Lint / Format / Typecheck

ルートの `package.json` にスクリプトを定義。ツールはルートの devDependencies で管理。

```bash
npm install              # ルートの依存をインストール
npm run lint             # oxlint で lint
npm run lint:fix         # oxlint --fix で自動修正
npm run format           # oxfmt でフォーマット
npm run format:check     # oxfmt でフォーマットチェック
npm run typecheck        # tsgo (typescript-go) で型チェック
```

- **Linter**: oxlint（`.oxlintrc.json` で設定）
- **Formatter**: oxfmt
- **Type checker**: tsgo (`@typescript/native-preview`)
- **Git hooks**: lefthook（`lefthook.yml`）— pre-commit で lint, format, typecheck を実行
- **CI**: GitHub Actions（`.github/workflows/ci.yml`）— push/PR 時に lint, format, typecheck を実行

## Architecture

### Tech Stack
- **Runtime**: Node.js 20 / TypeScript 5.9 / esbuild
- **Infrastructure**: AWS SAM (Lambda + API Gateway + S3)
- **AI**: Vercel AI SDK v4 (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
- **Alexa**: ask-sdk-core v2

### Lambda ソースコード (`lambda/src/`)

- `index.ts` — Lambda ハンドラーのエントリポイント。Alexa SDK の `SkillBuilders` で全ハンドラーを登録
- `speech.ts` — SSML生成、ランダム挨拶・別れの言葉
- `handlers/` — Alexa インテントハンドラー群（`canHandle` / `handle` パターン）
  - `AskAIIntentHandler.ts` — メインのAI問い合わせ処理。会話履歴管理・AI応答生成
  - `LaunchRequestHandler.ts` — スキル起動時。S3から記憶をロード
  - `CancelAndStopIntentHandler.ts` — セッション終了時に会話を要約・S3保存
- `ai/` — AI生成・設定
  - `registry.ts` — プロバイダーレジストリ。環境変数 `AI_MODEL` でモデルを決定（デフォルト: `google:gemini-2.5-flash`）
  - `generate.ts` — `generateText` による応答生成（maxSteps: 3）
  - `prompts.ts` — 日本語システムプロンプト（キャラ設定・応答ルール）
  - `tools.ts` — AIツール定義（webSearch, endSession）
- `memory/` — S3ベースの会話記憶
  - `memoryService.ts` — S3への記憶永続化
  - `summarize.ts` — 会話要約・統合（直近10セッション + 長期記憶、最大4000文字）

### Alexa スキル定義 (`skill-package/`)
- `interactionModels/custom/ja-JP.json` — 日本語インタラクションモデル。`AskAIIntent` に `{query}` スロット（ANY型）

### Infrastructure (`template.yaml`)
- **Lambda**: Node.js 20, 30秒タイムアウト, 256MB
- **S3 MemoryBucket**: 会話記憶の保存先（AES256暗号化）
- **API Gateway**: POST /alexa エンドポイント

## Key Conventions

- **日本語ファースト**: プロンプト・音声・インテントすべて日本語
- **音声出力**: SSMLの `<prosody rate="130%">` で再生速度調整。マークダウン記法は不可（音声読み上げのため）
- **AI応答**: 最大500文字。会話履歴は直近5ターン(10メッセージ)を保持
- **環境変数**: `AI_MODEL`（使用モデル）, `GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`（選択したプロバイダーのキー）, `TAVILY_API_KEY`, `MEMORY_BUCKET`
- **ESM**: `"type": "module"` を使用
