# Alexa AI Skill (Multi-Provider)

Alexa スキルから複数の AI モデル（Gemini / GPT / Claude）に質問できるスキルです。Vercel AI SDK の Provider Registry を使用し、音声指示でモデルを切り替えられます。Web 検索の Tool Calling にも対応しています。

S3 を使った長期記憶機能により、過去の会話内容を記憶し、次回以降のセッションでパーソナライズされた応答を提供します。

## アーキテクチャ

```
Alexa Device → Alexa Service → API Gateway (POST /alexa) → Lambda → AI Provider Registry
                                                              ↕        ├── Google Gemini 2.5 Flash
                                                           S3 Bucket   ├── OpenAI GPT-4o
                                                          (memories)   ├── Anthropic Claude Sonnet 4.5
                                                                       ↘ Tavily (Web検索)
```

### 長期記憶のデータフロー

```
LaunchRequest → S3 GET(memories.txt) → session属性に保存
     ↓
AskAIIntent → memories を system prompt に注入して AI に渡す
     ↓
セッション終了 → AI で会話を要約 → S3 PUT(追記) → 古い記憶は統合
```

## 技術スタック

- TypeScript / Node.js 20
- AWS Lambda + API Gateway (AWS SAM)
- Amazon S3（長期記憶の永続化）
- Vercel AI SDK (`ai` + `@ai-sdk/google` + `@ai-sdk/openai` + `@ai-sdk/anthropic`)
- Tavily API (Web 検索)

## 前提条件

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) がインストール・設定済み
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) がインストール済み
- [ASK CLI](https://developer.amazon.com/en-US/docs/alexa/smapi/quick-start-alexa-skills-kit-command-line-interface.html) がインストール済み（`npm install -g ask-cli`）
- [Amazon Developer アカウント](https://developer.amazon.com/)
- 使用するプロバイダーの API キー（少なくとも1つ）:
  - [Google AI Studio](https://aistudio.google.com/) - Gemini 用
  - [OpenAI](https://platform.openai.com/) - GPT 用
  - [Anthropic](https://console.anthropic.com/) - Claude 用
- [Tavily](https://tavily.com/) の API キー（Web 検索を使う場合）

## セットアップ

### 1. 依存関係のインストール

```bash
cd lambda
npm install
```

### 2. AWS SAM でバックエンドをデプロイ

```bash
# ビルド
sam build

# デプロイ（初回は --guided で対話的に設定）
sam deploy --guided
```

初回デプロイ時の設定例:

| パラメータ | 値 |
|---|---|
| Stack Name | `alexa-ai-skill` |
| AWS Region | `ap-northeast-1` |
| Confirm changes before deploy | `y` |
| Allow SAM CLI IAM role creation | `y` |

デプロイ完了後、Outputs に **AlexaEndpointUrl** が表示されます。この URL を控えておいてください。

```
---------------------------------------------
Outputs
---------------------------------------------
Key                 AlexaEndpointUrl
Description         API Gateway endpoint URL for Alexa skill
Value               https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/alexa
---------------------------------------------
```

### 3. Lambda の環境変数を設定

[AWS マネジメントコンソール](https://console.aws.amazon.com/lambda) → 作成された Lambda 関数を開き、「設定」→「環境変数」で以下を設定します。

| キー | 値 | 必須 |
|---|---|---|
| `AI_MODEL` | デフォルトで使用するモデル（例: `google:gemini-2.5-flash`） | 任意 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio の API キー | Gemini 使用時 |
| `OPENAI_API_KEY` | OpenAI の API キー | GPT 使用時 |
| `ANTHROPIC_API_KEY` | Anthropic の API キー | Claude 使用時 |
| `TAVILY_API_KEY` | Tavily の API キー | Web 検索使用時 |
| `MEMORY_BUCKET` | 長期記憶用 S3 バケット名 | 自動設定 |

> `MEMORY_BUCKET` は `sam deploy` 時に自動作成・設定されます。手動設定は不要です。

`AI_MODEL` の指定例:

| 値 | モデル |
|---|---|
| `google:gemini-2.5-flash` | Gemini 2.5 Flash（デフォルト） |
| `openai:gpt-4o` | GPT-4o |
| `anthropic:claude-sonnet-4-5-20250929` | Claude Sonnet 4.5 |

CLI で設定する場合:

```bash
aws lambda update-function-configuration \
  --function-name alexa-ai-skill-AISkillFunction-XXXX \
  --environment "Variables={AI_MODEL=google:gemini-2.5-flash,GOOGLE_GENERATIVE_AI_API_KEY=your-key,TAVILY_API_KEY=your-key}" \
  --region ap-northeast-1
```

### 4. Alexa Developer Console でスキルを作成

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) にログイン
2. 「スキルの作成」をクリック
3. 以下の設定でスキルを作成:
   - **スキル名**: `AI スキル`
   - **デフォルトの言語**: `日本語（日本）`
   - **スキルタイプ**: `カスタム` を選択
   - **ホスティング**: `独自のプロビジョニング` を選択

### 5. 対話モデルの設定

スキル作成後、左サイドバーの「対話モデル」→「JSON エディター」を開き、`skill-package/interactionModels/custom/ja-JP.json` の内容を貼り付けて「モデルを保存」→「モデルをビルド」を実行します。

あるいは ASK CLI を使う場合:

```bash
ask deploy --target skill-metadata
```

### 6. エンドポイントの設定

Alexa Developer Console で:

1. 左サイドバーの「エンドポイント」をクリック
2. **サービスのエンドポイントの種類**: `HTTPS` を選択
3. **デフォルトの地域**: 手順 2 で控えた API Gateway の URL を入力
   ```
   https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/alexa
   ```
4. **SSL 証明書の種類**: `開発用のエンドポイントは、証明機関が発行したワイルドカード証明書を持つドメインのサブドメインです` を選択
5. 「エンドポイントを保存」をクリック

### 7. テスト

Alexa Developer Console の「テスト」タブ:

1. テストを有効化（「開発中」に切り替え）
2. テキストまたは音声でテスト:

```
アレクサ、AIを開いて
→ 「AIスキルへようこそ。何でも聞いてください。」（初回）
→ 「おかえりなさい。何でも聞いてください。」（2回目以降）

今日の東京の天気を教えて
→ AI が Web 検索を使って回答

GPTに切り替えて
→ 「GPT-4oに切り替えました。何でも聞いてください。」

量子コンピュータについて教えて
→ GPT-4o が回答（過去に関連する会話があればそれを踏まえて回答）

今のモデルは何
→ 「現在はGPT-4oを使っています。」
```

## 使い方

| 発話例 | 動作 |
|---|---|
| 「アレクサ、AIを開いて」 | スキル起動 |
| 「量子コンピュータについて教えて」 | AI が回答 |
| 「今日のニュースを調べて」 | Web 検索して回答 |
| 「GPTに切り替えて」 | モデルを GPT-4o に変更 |
| 「クロードを使って」 | モデルを Claude に変更 |
| 「ジェミニにして」 | モデルを Gemini に戻す |
| 「今のモデルは何」 | 現在使用中のモデルを確認 |
| 「ヘルプ」 | 使い方の説明 |
| 「ストップ」 | スキル終了（会話内容を記憶に保存） |

## プロジェクト構成

```
alexa-ai-skill/
├── template.yaml                              # AWS SAM テンプレート (S3バケット含む)
├── samconfig.toml                             # SAM デプロイ設定
├── skill-package/
│   ├── skill.json                             # Alexa スキルマニフェスト
│   └── interactionModels/custom/
│       └── ja-JP.json                         # 日本語対話モデル
└── lambda/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts                           # Lambda エントリポイント
        ├── handlers/
        │   ├── LaunchRequestHandler.ts        # 起動時の挨拶 + 記憶読み込み
        │   ├── AskAIIntentHandler.ts          # AI 質問処理 + 終了時記憶保存
        │   ├── SwitchModelIntentHandler.ts    # モデル切り替え
        │   ├── CurrentModelIntentHandler.ts   # 現在のモデル確認
        │   ├── HelpIntentHandler.ts           # ヘルプ
        │   ├── CancelAndStopIntentHandler.ts  # 終了時記憶保存
        │   ├── SessionEndedRequestHandler.ts  # 終了時記憶保存 (フォールバック)
        │   └── ErrorHandler.ts
        ├── ai/
        │   ├── registry.ts                    # Provider Registry (マルチモデル)
        │   ├── generate.ts                    # AI テキスト生成 (記憶注入)
        │   ├── prompts.ts                     # System Prompt
        │   └── tools.ts                       # Web 検索ツール (Tavily)
        └── memory/
            ├── memoryService.ts               # S3 記憶の読み込み・保存・トリミング
            └── summarize.ts                   # AI による会話要約・記憶統合
```

## 長期記憶の仕組み

セッション終了時に会話内容を AI で要約し、S3 バケット内の `memories.txt` に追記します。次回セッション開始時にこの記憶を読み込み、AI の system prompt に注入することで、過去の会話を踏まえた応答を実現します。

### 記憶のフォーマット

```
[長期記憶]
プログラミング（TypeScript, React Native）に強い関心がある。
カレーなどの料理のレシピもよく質問する。

---
[2026-02-14 09:30]
TypeScriptの非同期処理について質問。async/awaitの使い方を説明した。
---
[2026-02-14 20:15]
夕飯のレシピを聞いた。カレーの作り方を説明した。
```

### 記憶の上限と忘却

| パラメータ | 値 | 説明 |
|---|---|---|
| MAX_RECENT_SECTIONS | 10 | 直近10セッション分を個別保持 |
| プロンプト注入上限 | 4000文字 | 超過時は古いセクションから切り捨て |

個別セクションが10を超えると、古いセクションを AI で「長期記憶」1セクションに統合します。これにより、重要な事実やパターンは長期記憶として残しつつ、直近の会話は個別に保持されます。
