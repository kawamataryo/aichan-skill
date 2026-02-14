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
      "あいちゃんには何でも質問できるよ。例えば「日本の首都はどこ」とか「量子コンピュータについて教えて」みたいに話しかけてね。GPTやクロードに切り替えることもできるよ。終わりたいときは「ストップ」って言ってね。";

    return handlerInput.responseBuilder
      .speak(fastSpeech(speechText))
      .reprompt(fastSpeech("何でも聞いてね。終わりたいときは「ストップ」って言ってね。"))
      .getResponse();
  },
};
