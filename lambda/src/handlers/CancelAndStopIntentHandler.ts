import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";
import { fastSpeech, randomFarewell } from "../speech";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

export const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  async handle(handlerInput) {
    const getElapsed = startTimer();
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);
    const conversationHistory: Array<{ role: string; content: string }> =
      attributes.conversationHistory ?? [];

    if (conversationHistory.length > 0) {
      try {
        const getSummarizeElapsed = startTimer();
        const { summary, profileUpdates } = await summarizeConversation(conversationHistory);
        const summarizeDurationMs = getSummarizeElapsed();
        const getSaveElapsed = startTimer();
        await saveMemory(userId, summary, profileUpdates);
        logInfo("stop.memory_saved", "CancelAndStopIntentHandler", {
          userId,
          durationMs: getSaveElapsed(),
          summarizeDurationMs,
          profileUpdateCount: Object.keys(profileUpdates).length,
          historyMessages: conversationHistory.length,
        });
      } catch (error) {
        logError("stop.memory_save.failed", "CancelAndStopIntentHandler", error, {
          userId,
          historyMessages: conversationHistory.length,
        });
      }
      // 二重保存防止
      attributes.conversationHistory = [];
      handlerInput.attributesManager.setSessionAttributes(attributes);
    }

    logInfo("stop.completed", "CancelAndStopIntentHandler", {
      userId,
      durationMs: getElapsed(),
      hadConversationHistory: conversationHistory.length > 0,
      historyMessages: conversationHistory.length,
    });

    return handlerInput.responseBuilder
      .speak(fastSpeech(randomFarewell()))
      .withShouldEndSession(true)
      .getResponse();
  },
};
