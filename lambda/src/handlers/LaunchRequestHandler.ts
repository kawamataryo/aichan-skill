import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { loadMemories, parseProfile, trimMemoriesForPrompt } from "../memory/memoryService";
import { fastSpeech, randomGreeting } from "../speech";
import { getUserId, hasPersonId } from "../util/getUserId";
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

    const hasPerson = hasPersonId(handlerInput.requestEnvelope);
    const needsProfileOnboarding = hasPerson && (!loaded.memories || !loaded.profile);
    if (needsProfileOnboarding) {
      attributes.needsProfileOnboarding = true;
    }

    handlerInput.attributesManager.setSessionAttributes(attributes);

    if (needsProfileOnboarding) {
      const onboardingPrompt =
        "はじめまして。あいちゃんだよ。あなたのことを覚えたいので、呼び名と年齢を教えてくれる？例えば「たろう、30歳だよ」みたいに話してね。";
      logInfo("launch.profile_onboarding_required", "LaunchRequestHandler", {
        userId,
        durationMs: getElapsed(),
        memoryLoadDurationMs: loadDurationMs,
        hasPersonId: hasPerson,
        hasMemories: Boolean(loaded.memories),
        hasProfile: Boolean(loaded.profile),
      });
      return handlerInput.responseBuilder
        .speak(fastSpeech(onboardingPrompt))
        .reprompt(fastSpeech(onboardingPrompt))
        .getResponse();
    }

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
