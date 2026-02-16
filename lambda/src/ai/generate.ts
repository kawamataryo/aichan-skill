import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { buildSystemPrompt } from "./prompts";
import { webSearchTool, createEndSessionTool } from "./tools";
import { getModel } from "./registry";
import type { PromptMemoryPayload } from "../memory/memoryService";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

export interface AIResponse {
  text: string;
  shouldEndSession?: boolean;
}

function parseEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const MAX_FACTS_FOR_PROMPT = parseEnvInt("MEMORY_PROMPT_MAX_FACTS", 4, 0, 20);
const MAX_EPISODES_FOR_PROMPT = parseEnvInt("MEMORY_PROMPT_MAX_EPISODES", 1, 0, 10);
const MAX_MEMORY_CHARS = parseEnvInt("MEMORY_PROMPT_MAX_CHARS", 1000, 200, 4000);

function parseTimestampMs(value: string): number {
  const iso = value.includes("T") ? value : value.replace(" ", "T").replace(/$/, ":00+09:00");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.toLowerCase();
  const tokens = normalized
    .split(/[、。！？\s,.\-_/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (normalized.length >= 2) tokens.push(normalized);
  return [...new Set(tokens)];
}

function scoreByQuery(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const normalized = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) score += 2;
  }
  return score;
}

function buildMemoryContext(query: string, payload?: PromptMemoryPayload): string | null {
  if (!payload) return null;
  const tokens = tokenizeQuery(query);
  const now = Date.now();

  const selectedFacts = [...payload.facts]
    .sort((a, b) => {
      const queryScoreA = scoreByQuery(a.content, tokens);
      const queryScoreB = scoreByQuery(b.content, tokens);
      if (queryScoreA !== queryScoreB) return queryScoreB - queryScoreA;
      const recentBonusA = Math.max(0, 30 - (now - parseTimestampMs(a.timestamp)) / 86400000) / 30;
      const recentBonusB = Math.max(0, 30 - (now - parseTimestampMs(b.timestamp)) / 86400000) / 30;
      return (
        queryScoreB + recentBonusB + b.confidence - (queryScoreA + recentBonusA + a.confidence)
      );
    })
    .slice(0, MAX_FACTS_FOR_PROMPT);

  const selectedEpisodes = [...payload.episodes]
    .sort((a, b) => {
      const queryScoreA = scoreByQuery(a.summary, tokens);
      const queryScoreB = scoreByQuery(b.summary, tokens);
      if (queryScoreA !== queryScoreB) return queryScoreB - queryScoreA;
      return parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp);
    })
    .slice(0, MAX_EPISODES_FOR_PROMPT);

  const lines: string[] = [];
  if (selectedFacts.length > 0) {
    lines.push("[覚えている事実]");
    for (const fact of selectedFacts) {
      lines.push(`- (${fact.category}) ${fact.content}`);
    }
  }
  if (selectedEpisodes.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("[最近の会話]");
    for (const episode of selectedEpisodes) {
      lines.push(`- ${episode.summary}`);
    }
  }
  if (lines.length === 0) return null;
  const text = lines.join("\n");
  return text.length <= MAX_MEMORY_CHARS ? text : text.slice(0, MAX_MEMORY_CHARS);
}

export async function generateAIResponse(
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  memories?: string,
  profile?: string,
  memoryPayload?: PromptMemoryPayload,
): Promise<AIResponse> {
  const getElapsed = startTimer();
  const messages: ModelMessage[] = conversationHistory.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  messages.push({ role: "user", content: query });

  let shouldEndSession = false;

  let systemPrompt = buildSystemPrompt(profile);
  const selectedMemory = buildMemoryContext(query, memoryPayload) ?? memories ?? null;
  if (profile) {
    systemPrompt += `\n\n## ユーザープロファイル\n${profile}`;
  }
  if (selectedMemory) {
    systemPrompt += `\n\n## 過去の会話の記憶\n${selectedMemory}`;
  }

  try {
    const { text } = await generateText({
      model: getModel(),
      system: systemPrompt,
      messages,
      tools: {
        webSearch: webSearchTool,
        endSession: createEndSessionTool(() => {
          shouldEndSession = true;
        }),
      },
      stopWhen: stepCountIs(3),
    });

    logInfo("ai.generate.completed", "generateAIResponse", {
      durationMs: getElapsed(),
      queryChars: query.length,
      historyMessages: conversationHistory.length,
      hasMemories: Boolean(selectedMemory),
      hasProfile: Boolean(profile),
      injectedMemoryChars: selectedMemory?.length ?? 0,
      outputChars: text.length,
      shouldEndSession,
    });

    return { text, shouldEndSession };
  } catch (error) {
    logError("ai.generate.failed", "generateAIResponse", error, {
      durationMs: getElapsed(),
      queryChars: query.length,
      historyMessages: conversationHistory.length,
      hasMemories: Boolean(selectedMemory),
      hasProfile: Boolean(profile),
    });
    throw error;
  }
}
