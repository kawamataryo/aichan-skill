import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  async handle(handlerInput) {
    const getElapsed = startTimer();
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);
    const conversationHistory: Array<{ role: string; content: string }> =
      attributes.conversationHistory ?? [];

    // 上流でクリア済みならスキップ
    if (conversationHistory.length > 0) {
      try {
        const getSummarizeElapsed = startTimer();
        const { summary, profileUpdates } = await summarizeConversation(conversationHistory);
        const summarizeDurationMs = getSummarizeElapsed();
        const getSaveElapsed = startTimer();
        await saveMemory(userId, summary, profileUpdates);
        logInfo("session_ended.memory_saved", "SessionEndedRequestHandler", {
          userId,
          durationMs: getSaveElapsed(),
          summarizeDurationMs,
          profileUpdateCount: Object.keys(profileUpdates).length,
          historyMessages: conversationHistory.length,
        });
      } catch (error) {
        logError("session_ended.memory_save.failed", "SessionEndedRequestHandler", error, {
          userId,
          historyMessages: conversationHistory.length,
        });
      }
    }

    handlerInput.attributesManager.setSessionAttributes({});
    logInfo("session_ended.completed", "SessionEndedRequestHandler", {
      userId,
      durationMs: getElapsed(),
      hadConversationHistory: conversationHistory.length > 0,
      historyMessages: conversationHistory.length,
    });
    return handlerInput.responseBuilder.getResponse();
  },
};
