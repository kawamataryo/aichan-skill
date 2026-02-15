import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { buildSystemPrompt } from "./prompts";
import { webSearchTool, createEndSessionTool } from "./tools";
import { getModel } from "./registry";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

export interface AIResponse {
  text: string;
  shouldEndSession?: boolean;
}

export async function generateAIResponse(
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  memories?: string,
  userName?: string,
  profile?: string,
): Promise<AIResponse> {
  const getElapsed = startTimer();
  const messages: ModelMessage[] = conversationHistory.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  messages.push({ role: "user", content: query });

  let shouldEndSession = false;

  let systemPrompt = buildSystemPrompt(userName);
  if (profile) {
    systemPrompt += `\n\n## ユーザープロファイル\n${profile}`;
  }
  if (memories) {
    systemPrompt += `\n\n## 過去の会話の記憶\n${memories}`;
  }

  try {
    const { text } = await generateText({
      model: getModel(),
      system: systemPrompt,
      messages,
      tools: {
        webSearch: webSearchTool,
        endSession: createEndSessionTool(() => {
          shouldEndSession = true;
        }),
      },
      stopWhen: stepCountIs(3),
    });

    logInfo("ai.generate.completed", "generateAIResponse", {
      durationMs: getElapsed(),
      queryChars: query.length,
      historyMessages: conversationHistory.length,
      hasMemories: Boolean(memories),
      hasProfile: Boolean(profile),
      hasUserName: Boolean(userName),
      outputChars: text.length,
      shouldEndSession,
    });

    return { text, shouldEndSession };
  } catch (error) {
    logError("ai.generate.failed", "generateAIResponse", error, {
      durationMs: getElapsed(),
      queryChars: query.length,
      historyMessages: conversationHistory.length,
      hasMemories: Boolean(memories),
      hasProfile: Boolean(profile),
      hasUserName: Boolean(userName),
    });
    throw error;
  }
}
