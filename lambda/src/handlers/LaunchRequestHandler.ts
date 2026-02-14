import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { loadMemories, trimMemoriesForPrompt } from "../memory/memoryService";

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();

    let memories: string | null = null;
    try {
      memories = await loadMemories();
    } catch {
      // S3 読み込み失敗時は記憶なしで続行
    }

    if (memories) {
      attributes.memories = trimMemoriesForPrompt(memories);
    }
    handlerInput.attributesManager.setSessionAttributes(attributes);

    const speechText = memories
      ? "おかえりなさい。何でも聞いてください。"
      : "AIスキルへようこそ。何でも聞いてください。";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};
