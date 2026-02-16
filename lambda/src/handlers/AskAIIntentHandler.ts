import Alexa from "ask-sdk-core";
import type { RequestHandler } from "ask-sdk-core";
import { generateAIResponse } from "../ai/generate";
import { summarizeConversation } from "../memory/summarize";
import { parseProfile, saveMemory, serializeProfile } from "../memory/memoryService";
import type { PromptMemoryPayload } from "../memory/memoryService";
import { getUserId } from "../util/getUserId";

import { fastSpeech, randomFarewell } from "../speech";
import { logError, logInfo, startTimer } from "../util/structuredLogger";
import { isFillerOnly } from "../util/isFillerOnly";

const MAX_HISTORY_TURNS = 5;

function extractInitialProfile(query: string): Record<string, string> {
  const updates: Record<string, string> = {};
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized) return updates;

  const labeledNameMatch = normalized.match(
    /(?:名前|なまえ|呼び名|ニックネーム)\s*(?:は|って|:|：)?\s*[「『"]?([^、。,\s「」『』"]{1,20})/,
  );
  const selfIntroNameMatch = normalized.match(
    /(?:わたし|私|ぼく|僕|おれ|俺)\s*は\s*([^、。,\s]{1,20})\s*です/,
  );
  const name = labeledNameMatch?.[1] ?? selfIntroNameMatch?.[1];
  if (name) updates["呼び名"] = name;

  const ageMatch = normalized.match(/([0-9]{1,3})\s*(?:歳|才|さい)/);
  if (ageMatch?.[1]) {
    updates["年齢"] = `${ageMatch[1]}歳`;
  }

  return updates;
}

export const AskAIIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AskAIIntent"
    );
  },
  async handle(handlerInput) {
    const getElapsed = startTimer();
    const query = Alexa.getSlotValue(handlerInput.requestEnvelope, "query") ?? "";
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const userId: string = attributes.userId ?? getUserId(handlerInput.requestEnvelope);

    if (isFillerOnly(query)) {
      logInfo("ask_ai.filler_only_blocked", "AskAIIntentHandler", {
        userId,
        durationMs: getElapsed(),
        queryChars: query.length,
      });
      const silentSsml = fastSpeech('<break time="1ms"/>');
      return handlerInput.responseBuilder
        .speak(silentSsml)
        .reprompt(silentSsml)
        .withShouldEndSession(false)
        .getResponse();
    }

    const needsProfileOnboarding: boolean = Boolean(attributes.needsProfileOnboarding);
    if (needsProfileOnboarding) {
      const profileUpdates = extractInitialProfile(query);
      if (Object.keys(profileUpdates).length === 0) {
        return handlerInput.responseBuilder
          .speak(
            fastSpeech(
              "ありがとう。呼び名か年齢のどちらかは入れて教えてね。例えば「たろう、30歳です」みたいに言ってくれると助かるよ。",
            ),
          )
          .reprompt(fastSpeech("呼び名と年齢を教えてね。"))
          .getResponse();
      }

      try {
        await saveMemory(userId, "初回プロフィール登録", profileUpdates, []);
      } catch (error) {
        logError("ask_ai.profile_onboarding_save.failed", "AskAIIntentHandler", error, {
          userId,
          profileUpdateCount: Object.keys(profileUpdates).length,
        });
      }

      const currentProfileText: string | undefined = attributes.profile;
      const currentProfile = currentProfileText ? parseProfile(currentProfileText) : {};
      const mergedProfile = { ...currentProfile, ...profileUpdates };
      attributes.profile = serializeProfile(mergedProfile);
      attributes.needsProfileOnboarding = false;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      logInfo("ask_ai.profile_onboarding_completed", "AskAIIntentHandler", {
        userId,
        durationMs: getElapsed(),
        queryChars: query.length,
        profileUpdateCount: Object.keys(profileUpdates).length,
      });

      return handlerInput.responseBuilder
        .speak(fastSpeech("教えてくれてありがとう。覚えたよ。今日はどんな話をしようか？"))
        .reprompt(fastSpeech("今日は何を話す？終わりたいときは「ストップ」って言ってね。"))
        .withShouldEndSession(false)
        .getResponse();
    }

    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
      attributes.conversationHistory ?? [];
    const memories: string | undefined = attributes.memories;
    const profile: string | undefined = attributes.profile;
    const memoryPayload: PromptMemoryPayload | undefined = attributes.memoryPayload;

    try {
      const getGenerateElapsed = startTimer();
      const result = await generateAIResponse(
        query,
        conversationHistory,
        memories,
        profile,
        memoryPayload,
      );
      const aiDurationMs = getGenerateElapsed();

      // セッション終了
      if (result.shouldEndSession) {
        conversationHistory.push({ role: "user", content: query });
        conversationHistory.push({ role: "assistant", content: result.text });

        try {
          const getSummarizeElapsed = startTimer();
          const { summary, profileUpdates, facts } =
            await summarizeConversation(conversationHistory);
          const summarizeDurationMs = getSummarizeElapsed();
          const getSaveElapsed = startTimer();
          await saveMemory(userId, summary, profileUpdates, facts);
          logInfo("ask_ai.memory_saved", "AskAIIntentHandler", {
            userId,
            durationMs: getSaveElapsed(),
            summarizeDurationMs,
            profileUpdateCount: Object.keys(profileUpdates).length,
            factCount: facts.length,
          });
        } catch (error) {
          logError("ask_ai.memory_save.failed", "AskAIIntentHandler", error, { userId });
        }

        attributes.conversationHistory = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);
        logInfo("ask_ai.completed_end_session", "AskAIIntentHandler", {
          userId,
          durationMs: getElapsed(),
          aiDurationMs,
          queryChars: query.length,
          historyMessagesBefore: conversationHistory.length,
          responseChars: result.text.length,
        });

        return handlerInput.responseBuilder
          .speak(fastSpeech(result.text || randomFarewell()))
          .withShouldEndSession(true)
          .getResponse();
      }

      conversationHistory.push({ role: "user", content: query });
      conversationHistory.push({ role: "assistant", content: result.text });

      const trimmed = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
      attributes.conversationHistory = trimmed;
      handlerInput.attributesManager.setSessionAttributes(attributes);
      logInfo("ask_ai.completed", "AskAIIntentHandler", {
        userId,
        durationMs: getElapsed(),
        aiDurationMs,
        queryChars: query.length,
        historyMessagesAfter: trimmed.length,
        responseChars: result.text.length,
      });

      return handlerInput.responseBuilder
        .speak(fastSpeech(result.text))
        .reprompt(fastSpeech("他に何かある？終わりたいときは「ストップ」って言ってね。"))
        .getResponse();
    } catch (error) {
      logError("ask_ai.failed", "AskAIIntentHandler", error, {
        userId,
        durationMs: getElapsed(),
        queryChars: query.length,
        historyMessages: conversationHistory.length,
      });
      return handlerInput.responseBuilder
        .speak(fastSpeech("すみません、うまく回答できませんでした。もう一度お試しください。"))
        .reprompt(fastSpeech("もう一回聞いてみて。終わりたいときは「ストップ」って言ってね。"))
        .getResponse();
    }
  },
};
