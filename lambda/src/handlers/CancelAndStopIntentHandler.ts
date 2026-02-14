import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";

export const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const conversationHistory: Array<{ role: string; content: string }> =
      attributes.conversationHistory ?? [];

    if (conversationHistory.length > 0) {
      try {
        const summary = await summarizeConversation(conversationHistory);
        await saveMemory(summary);
      } catch {
        // 記憶保存失敗時は無視
      }
      // 二重保存防止
      attributes.conversationHistory = [];
      handlerInput.attributesManager.setSessionAttributes(attributes);
    }

    return handlerInput.responseBuilder
      .speak("さようなら")
      .withShouldEndSession(true)
      .getResponse();
  },
};
