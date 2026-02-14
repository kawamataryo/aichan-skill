import type { ErrorHandler as ErrorHandlerType } from "ask-sdk-core";

export const ErrorHandler: ErrorHandlerType = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("Error handled:", error);

    return handlerInput.responseBuilder
      .speak("エラーが発生しました。もう一度お試しください。")
      .reprompt("もう一度お試しください。")
      .getResponse();
  },
};
