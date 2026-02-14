import { generateText, Output, jsonSchema } from "ai";
import { getModel } from "../ai/registry";

export interface SummarizeResult {
  summary: string;
  profileUpdates: Record<string, string>;
}

export async function summarizeConversation(
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<SummarizeResult> {
  const transcript = conversationHistory
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
    .join("\n");

  const { output } = await generateText({
    model: getModel(),
    maxOutputTokens: 1000,
    output: Output.object({
      schema: jsonSchema<SummarizeResult>({
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "会話の簡潔な要約。ユーザーの興味・関心、具体的な事実を優先的に残す。箇条書きではなく短い文章で。",
          },
          profileUpdates: {
            type: "object",
            additionalProperties: { type: "string" },
            description:
              "会話から判明したユーザーの個人情報（名前、住所、趣味、職業、年齢、家族構成、好きなものなど）をキーと値のペアで抽出。該当なしなら空オブジェクト。キーは日本語（例: 名前、住所、趣味）。",
          },
        },
        required: ["summary", "profileUpdates"],
      }),
    }),
    prompt: `以下の会話を分析してください。

1. 会話を簡潔に要約してください。ユーザーの興味・関心、具体的な事実（日付、好みなど）を優先的に残してください。箇条書きではなく、短い文章でまとめてください。
2. 会話からユーザーの個人情報（名前、住所、趣味、職業、年齢、家族構成、好きなもの、嫌いなものなど）を抽出してください。該当する情報がない場合は空のオブジェクトを返してください。

会話:
${transcript}`,
  });

  return output!;
}

export async function consolidateMemories(
  longTermMemory: string | null,
  oldSections: string[],
): Promise<string> {
  const existingPart = longTermMemory ? `既存の長期記憶:\n${longTermMemory}\n\n` : "";
  const sectionsPart = oldSections.join("\n---\n");

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1500,
    prompt: `以下の情報を統合して、ユーザーについての長期記憶を作成してください。
ユーザーの興味・関心、個人的な情報、具体的な事実（名前、日付、好み、よく聞く話題など）を優先的に残してください。
時系列の詳細は省略し、重要な事実やパターンに焦点を当ててください。
短い文章でまとめてください。

${existingPart}統合する記憶:
${sectionsPart}

統合された長期記憶:`,
  });

  return `[長期記憶]\n${text.trim()}`;
}
