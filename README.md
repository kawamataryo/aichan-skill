# AI Chan

Alexa 上で動作する、音声対話型の AI スキル。
Web 検索、S3 を使った会話メモリをサポート。

## 主な機能

- Vercel AI SDK によるAI応答（デプロイ時にモデル・プロバイダーを選択可能）
- Tavily API を使った Web 検索
- ユーザーごとの会話記憶を S3 に保存し、次回応答に反映
- SSML を使った読み上げ速度の調整

## アーキテクチャ

```mermaid
flowchart LR
    A[Alexa] --> B[API Gateway]
    B --> C[Lambda]
    C --> D[AI Provider]
    C --> E[S3<br/>memories]
```

## 技術スタック

`TypeScript` `Node.js 20` `AWS SAM` `Lambda` `S3` `Vercel AI SDK` `Tavily`

## セットアップ

```bash
# 1. 依存関係をインストール
cd lambda && npm install

# 2. API キーを設定
cp .envrc.example .envrc
# .envrc を編集して各キーを入力
direnv allow

# 3. デプロイ
make deploy
```

## Alexa スキル設定

デプロイ後、[Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) で設定する。

1. スキルを作成（言語: `日本語`、タイプ: `カスタム`、ホスティング: `独自のプロビジョニング`）
2. 対話モデルに `skill-package/interactionModels/custom/ja-JP.json` の内容を貼り付けて保存・ビルド
3. エンドポイントにデプロイ出力の `AlexaEndpointUrl` を設定

## 使い方

| 発話例 | 動作 |
|---|---|
| 「あいちゃんを開いて」 | 起動 |
| 「量子コンピュータについて教えて」 | AI が回答 |
| 「今日のニュースを調べて」 | Web 検索して回答 |
| 「ストップ」 | 終了（会話を記憶に保存） |

## 環境変数

| 変数 | 用途 |
|---|---|
| `AI_MODEL` | 使用するモデル（デフォルト: `google:gemini-2.5-flash`） |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI（Gemini 使用時） |
| `OPENAI_API_KEY` | OpenAI（GPT 使用時） |
| `ANTHROPIC_API_KEY` | Anthropic（Claude 使用時） |
| `TAVILY_API_KEY` | Web 検索 |

## ディレクトリ構成

```
├── template.yaml
├── Makefile
├── .envrc
└── lambda/src/
    ├── index.ts
    ├── speech.ts
    ├── handlers/
    │   ├── LaunchRequestHandler.ts
    │   ├── AskAIIntentHandler.ts
    │   ├── CancelAndStopIntentHandler.ts
    │   └── SessionEndedRequestHandler.ts
    ├── ai/
    │   ├── registry.ts
    │   ├── generate.ts
    │   ├── prompts.ts
    │   └── tools.ts
    ├── memory/
    │   ├── memoryService.ts
    │   └── summarize.ts
    └── util/
        └── getUserId.ts
```

## メモリの仕組み

- ユーザーごとに S3 の `memories/{userId}.txt` へ会話要約を保存
- ユーザー識別: `personId`（音声プロファイル）> `userId`（アカウント）> `_shared`（フォールバック）
- 次回起動時に保存内容をプロンプトへ注入
- 直近 10 セッションを保持し、超過分は長期記憶として統合
