import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";
import { fastSpeech, randomFarewell } from "../speech";

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
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);
    const conversationHistory: Array<{ role: string; content: string }> =
      attributes.conversationHistory ?? [];

    if (conversationHistory.length > 0) {
      try {
        const { summary, profileUpdates } = await summarizeConversation(conversationHistory);
        await saveMemory(userId, summary, profileUpdates);
      } catch (error) {
        console.error("Memory save error:", error);
      }
      // 二重保存防止
      attributes.conversationHistory = [];
      handlerInput.attributesManager.setSessionAttributes(attributes);
    }

    return handlerInput.responseBuilder
      .speak(fastSpeech(randomFarewell()))
      .withShouldEndSession(true)
      .getResponse();
  },
};
