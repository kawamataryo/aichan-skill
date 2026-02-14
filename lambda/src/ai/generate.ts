import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { buildSystemPrompt } from "./prompts";
import { webSearchTool, createEndSessionTool } from "./tools";
import { getModel } from "./registry";

export interface AIResponse {
  text: string;
  shouldEndSession?: boolean;
}

export async function generateAIResponse(
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  memories?: string,
  userName?: string,
): Promise<AIResponse> {
  const messages: ModelMessage[] = conversationHistory.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  messages.push({ role: "user", content: query });

  let shouldEndSession = false;

  let systemPrompt = buildSystemPrompt(userName);
  if (memories) {
    systemPrompt += `\n\n## 過去の会話の記憶\n${memories}`;
  }

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

  return { text, shouldEndSession };
}
