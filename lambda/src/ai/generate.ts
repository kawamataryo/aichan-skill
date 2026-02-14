import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import type { CoreMessage } from "ai";
import { SYSTEM_PROMPT } from "./prompts";
import { webSearchTool } from "./tools";

export async function generateAIResponse(
  query: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const messages: CoreMessage[] = conversationHistory.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  messages.push({ role: "user", content: query });

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      webSearch: webSearchTool,
    },
    maxSteps: 3,
  });

  return text;
}
