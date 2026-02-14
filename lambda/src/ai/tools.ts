import { tool } from "ai";
import { z } from "zod";
import { MODEL_ALIASES, getDisplayName } from "./registry";

export function createSwitchModelTool(onSwitch: (modelId: string) => void) {
  return tool({
    description:
      "AIモデルを切り替えます。ユーザーがGemini、GPT、Claudeなど別のモデルに切り替えたい・変えたい・使いたいと言った場合に使用してください。",
    parameters: z.object({
      model: z
        .enum(["ジェミニ", "GPT", "クロード"])
        .describe("切り替え先のモデル名"),
    }),
    execute: async ({ model }) => {
      const alias = MODEL_ALIASES[model];
      if (alias) {
        onSwitch(alias.modelId);
        return { success: true, displayName: alias.displayName };
      }
      return { success: false, error: "不明なモデルです" };
    },
  });
}

export function createGetCurrentModelTool(currentModelId: string) {
  return tool({
    description:
      "現在使用中のAIモデルを確認します。ユーザーが今のモデルは何か・何を使っているかを聞いた場合に使用してください。",
    parameters: z.object({}),
    execute: async () => {
      const displayName = getDisplayName(currentModelId);
      return { displayName };
    },
  });
}

export function createEndSessionTool(onEnd: () => void) {
  return tool({
    description:
      "スキルのセッションを終了します。ユーザーが会話を終わりたい・もういい・おしまい・バイバイなど終了の意思を示した場合に使用してください。",
    parameters: z.object({}),
    execute: async () => {
      onEnd();
      return { success: true };
    },
  });
}

export const webSearchTool = tool({
  description: "Web検索を実行して最新の情報を取得します",
  parameters: z.object({
    query: z.string().describe("検索クエリ"),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { results: "Web検索APIキーが設定されていません。" };
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 3,
        search_depth: "basic",
        include_answer: true,
      }),
    });

    if (!response.ok) {
      return { results: "検索に失敗しました。" };
    }

    const data = await response.json();
    if (data.answer) {
      return { results: data.answer };
    }
    const summaries = data.results
      ?.slice(0, 3)
      .map((r: any) => r.content)
      .join("\n");
    return { results: summaries || "検索結果が見つかりませんでした。" };
  },
});
