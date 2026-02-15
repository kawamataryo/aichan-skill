import { generateText, Output, jsonSchema } from "ai";
import { getModel } from "../ai/registry";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

export interface SummarizeResult {
  summary: string;
  profileUpdates: Record<string, string>;
}

interface RawSummarizeResult {
  summary: string;
  profileUpdates: Array<{ key: string; value: string }>;
}

export async function summarizeConversation(
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<SummarizeResult> {
  const getElapsed = startTimer();
  const transcript = conversationHistory
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
    .join("\n");

  try {
    const { output } = await generateText({
      model: getModel(),
      maxOutputTokens: 1000,
      output: Output.object({
        schema: jsonSchema<RawSummarizeResult>({
          type: "object",
          properties: {
            summary: {
              type: "string",
              description:
                "会話の簡潔な要約。ユーザーの興味・関心、具体的な事実を優先的に残す。箇条書きではなく短い文章で。",
            },
            profileUpdates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: {
                    type: "string",
                    description: "情報の種類（例: 名前、住所、趣味、職業）",
                  },
                  value: {
                    type: "string",
                    description: "情報の値",
                  },
                },
                required: ["key", "value"],
              },
              description:
                "会話から判明したユーザーの個人情報（名前、住所、趣味、職業、年齢、家族構成、好きなものなど）をキーと値のペアで抽出。該当なしなら空配列。",
            },
          },
          required: ["summary", "profileUpdates"],
        }),
      }),
      prompt: `以下の会話を分析してください。

1. 会話を簡潔に要約してください。ユーザーの興味・関心、具体的な事実（日付、好みなど）を優先的に残してください。箇条書きではなく、短い文章でまとめてください。
2. 会話からユーザーの個人情報（名前、住所、趣味、職業、年齢、家族構成、好きなもの、嫌いなものなど）を抽出してください。該当する情報がない場合は空の配列を返してください。

会話:
${transcript}`,
    });

    const raw = output!;
    const profileUpdates: Record<string, string> = {};
    for (const { key, value } of raw.profileUpdates) {
      profileUpdates[key] = value;
    }

    logInfo("memory.summarize.completed", "summarizeConversation", {
      durationMs: getElapsed(),
      historyMessages: conversationHistory.length,
      transcriptChars: transcript.length,
      summaryChars: raw.summary.length,
      profileUpdateCount: Object.keys(profileUpdates).length,
    });
    return { summary: raw.summary, profileUpdates };
  } catch (error) {
    logError("memory.summarize.failed", "summarizeConversation", error, {
      durationMs: getElapsed(),
      historyMessages: conversationHistory.length,
      transcriptChars: transcript.length,
    });
    throw error;
  }
}

export async function consolidateMemories(
  longTermMemory: string | null,
  oldSections: string[],
): Promise<string> {
  const getElapsed = startTimer();
  const existingPart = longTermMemory ? `既存の長期記憶:\n${longTermMemory}\n\n` : "";
  const sectionsPart = oldSections.join("\n---\n");

  try {
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
    logInfo("memory.consolidate.completed", "consolidateMemories", {
      durationMs: getElapsed(),
      oldSectionCount: oldSections.length,
      hadLongTermMemory: Boolean(longTermMemory),
      outputChars: text.trim().length,
    });
    return `[長期記憶]\n${text.trim()}`;
  } catch (error) {
    logError("memory.consolidate.failed", "consolidateMemories", error, {
      durationMs: getElapsed(),
      oldSectionCount: oldSections.length,
      hadLongTermMemory: Boolean(longTermMemory),
    });
    throw error;
  }
}
