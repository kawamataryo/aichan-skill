import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { MODEL_ALIASES } from "../ai/registry";

export const SwitchModelIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "SwitchModelIntent"
    );
  },
  handle(handlerInput) {
    const modelSlot = Alexa.getSlotValue(handlerInput.requestEnvelope, "model") ?? "";
    const alias = MODEL_ALIASES[modelSlot];

    if (!alias) {
      const available = Object.keys(MODEL_ALIASES).join("、");
      return handlerInput.responseBuilder
        .speak(`そのモデルには対応してないんだ。${available}から選んでね。`)
        .reprompt("どのモデルにする？")
        .getResponse();
    }

    const attributes = handlerInput.attributesManager.getSessionAttributes();
    attributes.modelId = alias.modelId;
    attributes.conversationHistory = [];
    handlerInput.attributesManager.setSessionAttributes(attributes);

    return handlerInput.responseBuilder
      .speak(`${alias.displayName}に切り替えたよ。何でも聞いてね。`)
      .reprompt("何でも聞いてね。終わりたいときは「ストップ」って言ってね。")
      .getResponse();
  },
};
