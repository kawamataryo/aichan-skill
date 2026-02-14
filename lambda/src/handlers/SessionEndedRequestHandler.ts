import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";

export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);
    const conversationHistory: Array<{ role: string; content: string }> =
      attributes.conversationHistory ?? [];

    // 上流でクリア済みならスキップ
    if (conversationHistory.length > 0) {
      try {
        const summary = await summarizeConversation(conversationHistory);
        await saveMemory(userId, summary);
      } catch (error) {
        console.error("Memory save error:", error);
      }
    }

    handlerInput.attributesManager.setSessionAttributes({});
    return handlerInput.responseBuilder.getResponse();
  },
};
