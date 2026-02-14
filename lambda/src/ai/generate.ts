import { generateText } from "ai";
import type { CoreMessage } from "ai";
import { SYSTEM_PROMPT } from "./prompts";
import {
  webSearchTool,
  createSwitchModelTool,
  createGetCurrentModelTool,
  createEndSessionTool,
} from "./tools";
import { getModel } from "./registry";

const DEFAULT_MODEL = "google:gemini-2.5-flash";

export interface AIResponse {
  text: string;
  switchToModel?: string;
  shouldEndSession?: boolean;
}

export async function generateAIResponse(
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  modelId?: string,
  memories?: string,
): Promise<AIResponse> {
  const messages: CoreMessage[] = conversationHistory.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  messages.push({ role: "user", content: query });

  let switchToModel: string | undefined;
  let shouldEndSession = false;

  const currentModelId = modelId ?? process.env.AI_MODEL ?? DEFAULT_MODEL;

  let systemPrompt = SYSTEM_PROMPT;
  if (memories) {
    systemPrompt += `\n\n## 過去の会話の記憶\n${memories}`;
  }

  const { text } = await generateText({
    model: getModel(modelId),
    system: systemPrompt,
    messages,
    tools: {
      webSearch: webSearchTool,
      switchModel: createSwitchModelTool((newModelId) => {
        switchToModel = newModelId;
      }),
      getCurrentModel: createGetCurrentModelTool(currentModelId),
      endSession: createEndSessionTool(() => {
        shouldEndSession = true;
      }),
    },
    maxSteps: 3,
  });

  return { text, switchToModel, shouldEndSession };
}
