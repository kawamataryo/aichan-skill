import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";

export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    // Clean up session attributes
    handlerInput.attributesManager.setSessionAttributes({});
    return handlerInput.responseBuilder.getResponse();
  },
};
