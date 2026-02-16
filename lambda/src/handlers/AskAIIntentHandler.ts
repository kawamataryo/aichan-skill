import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { generateAIResponse } from "../ai/generate";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";
import type { PromptMemoryPayload } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";

import { fastSpeech, randomFarewell } from "../speech";
import { logError, logInfo, startTimer } from "../util/structuredLogger";
import { isFillerOnly } from "../util/isFillerOnly";

const MAX_HISTORY_TURNS = 5;

export const AskAIIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AskAIIntent"
    );
  },
  async handle(handlerInput) {
    const getElapsed = startTimer();
    const query = Alexa.getSlotValue(handlerInput.requestEnvelope, "query") ?? "";
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);

    if (isFillerOnly(query)) {
      logInfo("ask_ai.filler_only_blocked", "AskAIIntentHandler", {
        userId,
        durationMs: getElapsed(),
        queryChars: query.length,
      });
      const silentSsml = fastSpeech('<break time="1ms"/>');
      return handlerInput.responseBuilder
        .speak(silentSsml)
        .reprompt(silentSsml)
        .withShouldEndSession(false)
        .getResponse();
    }

    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
      attributes.conversationHistory ?? [];
    const memories: string | undefined = attributes.memories;
    const profile: string | undefined = attributes.profile;
    const memoryPayload: PromptMemoryPayload | undefined = attributes.memoryPayload;

    try {
      const getGenerateElapsed = startTimer();
      const result = await generateAIResponse(
        query,
        conversationHistory,
        memories,
        profile,
        memoryPayload,
      );
      const aiDurationMs = getGenerateElapsed();

      // セッション終了
      if (result.shouldEndSession) {
        conversationHistory.push({ role: "user", content: query });
        conversationHistory.push({ role: "assistant", content: result.text });

        try {
          const getSummarizeElapsed = startTimer();
          const { summary, profileUpdates, facts } =
            await summarizeConversation(conversationHistory);
          const summarizeDurationMs = getSummarizeElapsed();
          const getSaveElapsed = startTimer();
          await saveMemory(userId, summary, profileUpdates, facts);
          logInfo("ask_ai.memory_saved", "AskAIIntentHandler", {
            userId,
            durationMs: getSaveElapsed(),
            summarizeDurationMs,
            profileUpdateCount: Object.keys(profileUpdates).length,
            factCount: facts.length,
          });
        } catch (error) {
          logError("ask_ai.memory_save.failed", "AskAIIntentHandler", error, { userId });
        }

        attributes.conversationHistory = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);
        logInfo("ask_ai.completed_end_session", "AskAIIntentHandler", {
          userId,
          durationMs: getElapsed(),
          aiDurationMs,
          queryChars: query.length,
          historyMessagesBefore: conversationHistory.length,
          responseChars: result.text.length,
        });

        return handlerInput.responseBuilder
          .speak(fastSpeech(result.text || randomFarewell()))
          .withShouldEndSession(true)
          .getResponse();
      }

      conversationHistory.push({ role: "user", content: query });
      conversationHistory.push({ role: "assistant", content: result.text });

      const trimmed = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
      attributes.conversationHistory = trimmed;
      handlerInput.attributesManager.setSessionAttributes(attributes);
      logInfo("ask_ai.completed", "AskAIIntentHandler", {
        userId,
        durationMs: getElapsed(),
        aiDurationMs,
        queryChars: query.length,
        historyMessagesAfter: trimmed.length,
        responseChars: result.text.length,
      });

      return handlerInput.responseBuilder
        .speak(fastSpeech(result.text))
        .reprompt(fastSpeech("他に何かある？終わりたいときは「ストップ」って言ってね。"))
        .getResponse();
    } catch (error) {
      logError("ask_ai.failed", "AskAIIntentHandler", error, {
        userId,
        durationMs: getElapsed(),
        queryChars: query.length,
        historyMessages: conversationHistory.length,
      });
      return handlerInput.responseBuilder
        .speak(fastSpeech("すみません、うまく回答できませんでした。もう一度お試しください。"))
        .reprompt(fastSpeech("もう一回聞いてみて。終わりたいときは「ストップ」って言ってね。"))
        .getResponse();
    }
  },
};
