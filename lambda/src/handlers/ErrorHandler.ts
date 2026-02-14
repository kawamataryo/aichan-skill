import type { ErrorHandler as ErrorHandlerType } from "ask-sdk-core";

export const ErrorHandler: ErrorHandlerType = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("Error handled:", error);

    return handlerInput.responseBuilder
      .speak("ごめんね、エラーが起きちゃった。もう一回試してみて。")
      .reprompt("もう一回聞いてみて。終わりたいときは「ストップ」って言ってね。")
      .getResponse();
  },
};
