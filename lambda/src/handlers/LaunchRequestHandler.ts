import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  handle(handlerInput) {
    const speechText = "ジェミニスキルへようこそ。何でも聞いてください。";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};
