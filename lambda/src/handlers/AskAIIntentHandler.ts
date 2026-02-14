import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { generateAIResponse } from "../ai/generate";
import { summarizeConversation } from "../memory/summarize";
import { saveMemory } from "../memory/memoryService";

import { fastSpeech } from "../speech";

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

    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
      attributes.conversationHistory ?? [];
    const modelId: string | undefined = attributes.modelId;
    const memories: string | undefined = attributes.memories;

    try {
      const result = await generateAIResponse(query, conversationHistory, modelId, memories);

      // セッション終了
      if (result.shouldEndSession) {
        // 会話履歴に最後のやりとりを追加してから要約
        conversationHistory.push({ role: "user", content: query });
        conversationHistory.push({ role: "assistant", content: result.text });

        try {
          const summary = await summarizeConversation(conversationHistory);
          await saveMemory(summary);
        } catch (error) {
          console.error("Memory save error:", error);
        }

        // 二重保存防止: conversationHistory をクリア
        attributes.conversationHistory = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);

        return handlerInput.responseBuilder
          .speak(fastSpeech(result.text || "さようなら"))
          .withShouldEndSession(true)
          .getResponse();
      }

      // モデル切り替えが行われた場合、セッションを更新して会話履歴をリセット
      if (result.switchToModel) {
        attributes.modelId = result.switchToModel;
        attributes.conversationHistory = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);

        return handlerInput.responseBuilder
          .speak(fastSpeech(result.text))
          .reprompt(fastSpeech("何でも聞いてください。"))
          .getResponse();
      }

      conversationHistory.push({ role: "user", content: query });
      conversationHistory.push({ role: "assistant", content: result.text });

      const trimmed = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
      attributes.conversationHistory = trimmed;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      return handlerInput.responseBuilder
        .speak(fastSpeech(result.text))
        .reprompt(fastSpeech("他に何か聞きたいことはありますか？"))
        .getResponse();
    } catch (error) {
      console.error("AskAIIntent error:", error);
      return handlerInput.responseBuilder
        .speak(fastSpeech("すみません、うまく回答できませんでした。もう一度お試しください。"))
        .reprompt(fastSpeech("もう一度質問してください。"))
        .getResponse();
    }
  },
};
