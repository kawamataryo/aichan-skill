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
      .speak(`現在は${displayName}を使っています。`)
      .reprompt("他に何か聞きたいことはありますか？")
      .getResponse();
  },
};
