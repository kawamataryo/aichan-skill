import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { generateAIResponse } from "../ai/generate";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";

import { fastSpeech, randomFarewell } from "../speech";

const MAX_HISTORY_TURNS = 5;

export const AskAIIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AskAIIntent"
    );
  },
  async handle(handlerInput) {
    const query = Alexa.getSlotValue(handlerInput.requestEnvelope, "query") ?? "";
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);

    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
      attributes.conversationHistory ?? [];
    const memories: string | undefined = attributes.memories;
    const userName: string | undefined = attributes.userName;

    try {
      const result = await generateAIResponse(query, conversationHistory, memories, userName);

      // セッション終了
      if (result.shouldEndSession) {
        conversationHistory.push({ role: "user", content: query });
        conversationHistory.push({ role: "assistant", content: result.text });

        try {
          const summary = await summarizeConversation(conversationHistory);
          await saveMemory(userId, summary);
        } catch (error) {
          console.error("Memory save error:", error);
        }

        attributes.conversationHistory = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);

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

      return handlerInput.responseBuilder
        .speak(fastSpeech(result.text))
        .reprompt(fastSpeech("他に何かある？終わりたいときは「ストップ」って言ってね。"))
        .getResponse();
    } catch (error) {
      console.error("AskAIIntent error:", error);
      return handlerInput.responseBuilder
        .speak(fastSpeech("すみません、うまく回答できませんでした。もう一度お試しください。"))
        .reprompt(fastSpeech("もう一回聞いてみて。終わりたいときは「ストップ」って言ってね。"))
        .getResponse();
    }
  },
};
