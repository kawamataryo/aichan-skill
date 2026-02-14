import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { loadMemories, trimMemoriesForPrompt } from "../memory/memoryService";
import { fastSpeech, randomGreeting } from "../speech";
import { getUserId } from "../util/getUserId";

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId = getUserId(handlerInput.requestEnvelope);
    attributes.userId = userId;

    let memories: string | null = null;
    try {
      memories = await loadMemories(userId);
    } catch (error) {
      console.error("Memory load error:", error);
    }

    if (memories) {
      attributes.memories = trimMemoriesForPrompt(memories);
    }
    handlerInput.attributesManager.setSessionAttributes(attributes);

    const speechText = randomGreeting();

    return handlerInput.responseBuilder
      .speak(fastSpeech(speechText))
      .reprompt(fastSpeech(speechText))
      .getResponse();
  },
};
