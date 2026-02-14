import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { fastSpeech } from "../speech";

export const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speechText =
      "このスキルでは、AIに何でも質問できます。例えば「日本の首都はどこ」や「量子コンピュータについて教えて」のように話しかけてください。GPTやクロードに切り替えることもできます。";

    return handlerInput.responseBuilder
      .speak(fastSpeech(speechText))
      .reprompt(fastSpeech(speechText))
      .getResponse();
  },
};
