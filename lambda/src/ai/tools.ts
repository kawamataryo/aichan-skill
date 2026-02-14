import { tool, jsonSchema } from "ai";

export function createEndSessionTool(onEnd: () => void) {
  return tool({
    description:
      "スキルのセッションを終了します。ユーザーが会話を終わりたい・もういい・おしまい・バイバイなど終了の意思を示した場合に使用してください。",
    inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
    execute: async () => {
      onEnd();
      return { success: true };
    },
  });
}

export const webSearchTool = tool({
  description: "Web検索を実行して最新の情報を取得します",
  inputSchema: jsonSchema<{ query: string }>({
    type: "object",
    properties: {
      query: { type: "string", description: "検索クエリ" },
    },
    required: ["query"],
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
