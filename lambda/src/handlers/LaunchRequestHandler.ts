import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { loadMemories, trimMemoriesForPrompt } from "../memory/memoryService";
import { fastSpeech, randomGreeting } from "../speech";

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();

    let memories: string | null = null;
    try {
      memories = await loadMemories();
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
