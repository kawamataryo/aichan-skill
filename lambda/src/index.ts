import Alexa from "ask-sdk-core";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { LaunchRequestHandler } from "./handlers/LaunchRequestHandler";
import { AskAIIntentHandler } from "./handlers/AskAIIntentHandler";
import { HelpIntentHandler } from "./handlers/HelpIntentHandler";
import { CancelAndStopIntentHandler } from "./handlers/CancelAndStopIntentHandler";
import { SessionEndedRequestHandler } from "./handlers/SessionEndedRequestHandler";
import { ErrorHandler } from "./handlers/ErrorHandler";

const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AskAIIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .create();

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestBody = JSON.parse(event.body || "{}");
  const response = await skill.invoke(requestBody);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  };
};
