import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { generateAIResponse } from "../ai/generate";

const MAX_HISTORY_TURNS = 5;

export const GeminiIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "GeminiIntent"
    );
  },
  async handle(handlerInput) {
    const query = Alexa.getSlotValue(handlerInput.requestEnvelope, "query") ?? "";

    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
      attributes.conversationHistory ?? [];

    try {
      const answer = await generateAIResponse(query, conversationHistory);

      conversationHistory.push({ role: "user", content: query });
      conversationHistory.push({ role: "assistant", content: answer });

      // Keep only the last N turns
      const trimmed = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
      attributes.conversationHistory = trimmed;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      return handlerInput.responseBuilder
        .speak(answer)
        .reprompt("他に何か聞きたいことはありますか？")
        .getResponse();
    } catch {
      return handlerInput.responseBuilder
        .speak("すみません、うまく回答できませんでした。もう一度お試しください。")
        .reprompt("もう一度質問してください。")
        .getResponse();
    }
  },
};
