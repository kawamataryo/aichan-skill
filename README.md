# Gemini Skill - Alexa × Gemini 2.5 Flash

Alexa スキルから Google Gemini 2.5 Flash に質問できるスキルです。Vercel AI SDK を使用し、Web 検索の Tool Calling にも対応しています。

## アーキテクチャ

```
Alexa Device → Alexa Service → API Gateway (POST /alexa) → Lambda → Gemini 2.5 Flash
                                                                  ↘ Tavily (Web検索)
```

## 技術スタック

- TypeScript / Node.js 20
- AWS Lambda + API Gateway (AWS SAM)
- Vercel AI SDK (`ai` + `@ai-sdk/google`)
- Google Gemini 2.5 Flash
- Tavily API (Web 検索)

## 前提条件

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) がインストール・設定済み
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) がインストール済み
- [ASK CLI](https://developer.amazon.com/en-US/docs/alexa/smapi/quick-start-alexa-skills-kit-command-line-interface.html) がインストール済み（`npm install -g ask-cli`）
- [Amazon Developer アカウント](https://developer.amazon.com/)
- [Google AI Studio](https://aistudio.google.com/) の API キー
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
| Stack Name | `gemini-skill` |
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

| キー | 値 |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio で取得した API キー |
| `TAVILY_API_KEY` | Tavily で取得した API キー |

または CLI で設定:

```bash
aws lambda update-function-configuration \
  --function-name gemini-skill-GeminiSkillFunction-XXXX \
  --environment "Variables={GOOGLE_GENERATIVE_AI_API_KEY=your-key,TAVILY_API_KEY=your-key}" \
  --region ap-northeast-1
```

### 4. Alexa Developer Console でスキルを作成

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) にログイン
2. 「スキルの作成」をクリック
3. 以下の設定でスキルを作成:
   - **スキル名**: `Gemini スキル`
   - **デフォルトの言語**: `日本語（日本）`
   - **スキルタイプ**: `カスタム` を選択
   - **ホスティング**: `独自のプロビジョニング` を選択

### 5. 対話モデルの設定

スキル作成後、左サイドバーの「対話モデル」→「JSON エディター」を開き、`skill-package/interactionModels/custom/ja-JP.json` の内容を貼り付けて「モデルを保存」→「モデルをビルド」を実行します。

あるいは ASK CLI を使う場合:

```bash
# ASK CLI でスキルをデプロイ（skill-package/ 配下を使用）
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
2. テキストまたは音声で以下のように話しかける:
   ```
   アレクサ、ジェミニを開いて
   ```
   → 「ジェミニスキルへようこそ。何でも聞いてください。」
   ```
   今日の東京の天気を教えて
   ```
   → Gemini が Web 検索を使って回答

## プロジェクト構成

```
gemini-skill/
├── template.yaml                          # AWS SAM テンプレート
├── samconfig.toml                         # SAM デプロイ設定
├── skill-package/
│   ├── skill.json                         # Alexa スキルマニフェスト
│   └── interactionModels/custom/
│       └── ja-JP.json                     # 日本語対話モデル
└── lambda/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts                       # Lambda エントリポイント
        ├── handlers/
        │   ├── LaunchRequestHandler.ts    # 起動時の挨拶
        │   ├── GeminiIntentHandler.ts     # AI 質問処理
        │   ├── HelpIntentHandler.ts       # ヘルプ
        │   ├── CancelAndStopIntentHandler.ts
        │   ├── SessionEndedRequestHandler.ts
        │   └── ErrorHandler.ts
        └── ai/
            ├── generate.ts                # Gemini 2.5 Flash 呼び出し
            ├── prompts.ts                 # System Prompt
            └── tools.ts                   # Web 検索ツール (Tavily)
```

## 使い方

| 発話例 | 動作 |
|---|---|
| 「アレクサ、ジェミニを開いて」 | スキル起動 |
| 「量子コンピュータについて教えて」 | Gemini が回答 |
| 「今日のニュースを調べて」 | Web 検索して回答 |
| 「ヘルプ」 | 使い方の説明 |
| 「ストップ」 | スキル終了 |
