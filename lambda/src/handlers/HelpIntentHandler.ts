import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";

export const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speechText =
      "このスキルでは、ジェミニAIに何でも質問できます。例えば「日本の首都はどこ」や「量子コンピュータについて教えて」のように話しかけてください。";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};
