import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import type { RequestEnvelope } from "ask-sdk-model";
import { loadMemories, trimMemoriesForPrompt } from "../memory/memoryService";
import { fastSpeech, randomGreeting } from "../speech";
import { getUserId } from "../util/getUserId";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

async function fetchUserName(requestEnvelope: RequestEnvelope): Promise<string | null> {
  const apiEndpoint = requestEnvelope.context.System.apiEndpoint;
  const apiAccessToken = requestEnvelope.context.System.apiAccessToken;
  if (!apiEndpoint || !apiAccessToken) return null;

  const headers = { Authorization: `Bearer ${apiAccessToken}` };
  const person = requestEnvelope.context.System.person;

  if (person?.personId) {
    try {
      const res = await fetch(`${apiEndpoint}/v2/persons/~current/profile/givenName`, { headers });
      if (res.ok) return await res.text();
    } catch {
      // personId での取得失敗時は userId でフォールバック
    }
  }

  try {
    const res = await fetch(`${apiEndpoint}/v2/accounts/~current/settings/Profile.givenName`, {
      headers,
    });
    if (res.ok) return await res.text();
  } catch {
    // 権限未付与やエラー時は名前なしで継続
  }

  return null;
}

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    const getElapsed = startTimer();
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId = getUserId(handlerInput.requestEnvelope);
    attributes.userId = userId;

    const getLoadElapsed = startTimer();
    const [loaded, userName] = await Promise.all([
      loadMemories(userId).catch((error) => {
        logError("memory.load.failed", "LaunchRequestHandler", error, { userId });
        return { profile: null, memories: null };
      }),
      fetchUserName(handlerInput.requestEnvelope),
    ]);
    const loadDurationMs = getLoadElapsed();

    if (loaded.memories) {
      attributes.memories = trimMemoriesForPrompt(loaded.memories);
    }
    if (loaded.profile) {
      attributes.profile = loaded.profile;
    }
    if (userName) {
      attributes.userName = userName;
    }
    handlerInput.attributesManager.setSessionAttributes(attributes);

    const speechText = randomGreeting();
    logInfo("launch.completed", "LaunchRequestHandler", {
      userId,
      durationMs: getElapsed(),
      memoryLoadDurationMs: loadDurationMs,
      hasMemories: Boolean(loaded.memories),
      hasProfile: Boolean(loaded.profile),
      hasUserName: Boolean(userName),
      memoryChars: loaded.memories?.length ?? 0,
    });

    return handlerInput.responseBuilder
      .speak(fastSpeech(speechText))
      .reprompt(fastSpeech(speechText))
      .getResponse();
  },
};
