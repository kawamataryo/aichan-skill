import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { getDisplayName } from "../ai/registry";

const DEFAULT_MODEL = "google:gemini-2.5-flash";

export const CurrentModelIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "CurrentModelIntent"
    );
  },
  handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const modelId = (attributes.modelId as string) ?? DEFAULT_MODEL;
    const displayName = getDisplayName(modelId);

    return handlerInput.responseBuilder
      .speak(`今は${displayName}を使ってるよ。`)
      .reprompt("他に何かある？終わりたいときは「ストップ」って言ってね。")
      .getResponse();
  },
};
