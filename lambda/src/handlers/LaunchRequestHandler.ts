import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { loadMemories, parseProfile, trimMemoriesForPrompt } from "../memory/memoryService";
import { fastSpeech, randomGreeting } from "../speech";
import { getUserId } from "../util/getUserId";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

function extractDisplayNameFromProfile(profileText: string | null): string | null {
  if (!profileText) return null;
  const profile = parseProfile(profileText);
  const keys = ["呼び名", "ニックネーム", "名前", "氏名"];
  for (const key of keys) {
    const value = profile[key]?.trim();
    if (value) return value;
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
    const loaded = await loadMemories(userId).catch((error) => {
      logError("memory.load.failed", "LaunchRequestHandler", error, { userId });
      return { profile: null, memories: null, memoryPayload: null };
    });
    const loadDurationMs = getLoadElapsed();

    if (loaded.memories) {
      attributes.memories = trimMemoriesForPrompt(loaded.memories);
    }
    if (loaded.profile) {
      attributes.profile = loaded.profile;
    }
    if (loaded.memoryPayload) {
      attributes.memoryPayload = loaded.memoryPayload;
    }
    handlerInput.attributesManager.setSessionAttributes(attributes);

    const displayName = extractDisplayNameFromProfile(loaded.profile);
    const speechText = displayName ? `${displayName}、${randomGreeting()}` : randomGreeting();
    logInfo("launch.completed", "LaunchRequestHandler", {
      userId,
      durationMs: getElapsed(),
      memoryLoadDurationMs: loadDurationMs,
      hasMemories: Boolean(loaded.memories),
      hasProfile: Boolean(loaded.profile),
      hasDisplayName: Boolean(displayName),
      memoryChars: loaded.memories?.length ?? 0,
    });

    return handlerInput.responseBuilder
      .speak(fastSpeech(speechText))
      .reprompt(fastSpeech(speechText))
      .getResponse();
  },
};
