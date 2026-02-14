import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";

export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const conversationHistory: Array<{ role: string; content: string }> =
      attributes.conversationHistory ?? [];

    // 上流でクリア済みならスキップ
    if (conversationHistory.length > 0) {
      try {
        const summary = await summarizeConversation(conversationHistory);
        await saveMemory(summary);
      } catch {
        // 記憶保存失敗時は無視
      }
    }

    handlerInput.attributesManager.setSessionAttributes({});
    return handlerInput.responseBuilder.getResponse();
  },
};
