import { generateText } from "ai";
import { getModel } from "../ai/registry";

export async function summarizeConversation(
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<string> {
  const transcript = conversationHistory
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
    .join("\n");

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1000,
    prompt: `以下の会話を簡潔に要約してください。
ユーザーの興味・関心、個人的な情報、具体的な事実（名前、日付、好みなど）を優先的に残してください。
箇条書きではなく、短い文章でまとめてください。

会話:
${transcript}

要約:`,
  });

  return text.trim();
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
