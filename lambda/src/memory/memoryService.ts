import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { ExtractedFact } from "./summarize";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

const s3 = new S3Client({});
const BUCKET = process.env.MEMORY_BUCKET!;

function getMemoryKey(userId: string): string {
  return `memories/${userId}.json`;
}
const MAX_PROMPT_CHARS = 4000;
const MAX_FACTS = 60;
const MAX_EPISODES = 12;
const MAX_LAUNCH_FACTS = 3;
const MAX_LAUNCH_EPISODES = 1;
const MEMORY_VERSION = 2;

interface MemoryFact {
  id: string;
  category: string;
  content: string;
  confidence: number;
  timestamp: string;
  source: "session" | "inferred";
}

interface MemoryEpisode {
  timestamp: string;
  summary: string;
}

interface MemoryV2 {
  version: 2;
  revision: number;
  updatedAt: string;
  profile: Record<string, string>;
  facts: MemoryFact[];
  episodes: MemoryEpisode[];
}

export interface PromptMemoryPayload {
  facts: Array<{
    category: string;
    content: string;
    confidence: number;
    timestamp: string;
  }>;
  episodes: Array<{
    timestamp: string;
    summary: string;
  }>;
}

export interface LoadedMemories {
  profile: string | null;
  memories: string | null;
  memoryPayload: PromptMemoryPayload | null;
}

function createEmptyMemory(): MemoryV2 {
  return {
    version: MEMORY_VERSION,
    revision: 0,
    updatedAt: new Date().toISOString(),
    profile: {},
    facts: [],
    episodes: [],
  };
}

function formatJSTDate(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function normalizeFactContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().toLowerCase();
}

function createFactId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTimestampMs(value: string): number {
  const iso = value.includes("T") ? value : value.replace(" ", "T").replace(/$/, ":00+09:00");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function sortByTimestampDesc<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));
}

function isSensitiveFact(category: string, content: string): boolean {
  const blockedCategories = new Set([
    "health",
    "medical",
    "financial",
    "credential",
    "auth",
    "address_exact",
  ]);
  if (blockedCategories.has(category.toLowerCase())) return true;
  const pattern =
    /(パスワード|暗証番号|クレジット|カード番号|口座番号|マイナンバー|保険証|免許証|電話番号|住所.*[0-9０-９])/;
  return pattern.test(content);
}

function toPromptPayload(memory: MemoryV2): PromptMemoryPayload {
  return {
    facts: sortByTimestampDesc(memory.facts).map((f) => ({
      category: f.category,
      content: f.content,
      confidence: f.confidence,
      timestamp: f.timestamp,
    })),
    episodes: sortByTimestampDesc(memory.episodes).map((e) => ({
      timestamp: e.timestamp,
      summary: e.summary,
    })),
  };
}

function buildLaunchMemoriesText(memory: MemoryV2): string | null {
  const facts = sortByTimestampDesc(memory.facts).slice(0, MAX_LAUNCH_FACTS);
  const episodes = sortByTimestampDesc(memory.episodes).slice(0, MAX_LAUNCH_EPISODES);
  const lines: string[] = [];
  if (facts.length > 0) {
    lines.push("[覚えていること]");
    for (const fact of facts) {
      lines.push(`- (${fact.category}) ${fact.content}`);
    }
  }
  if (episodes.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("[最近の会話]");
    for (const episode of episodes) {
      lines.push(`- ${episode.summary}`);
    }
  }
  if (lines.length === 0) return null;
  return trimMemoriesForPrompt(lines.join("\n"));
}

function isMemoryV2(input: unknown): input is MemoryV2 {
  const value = input as Partial<MemoryV2> | null;
  if (!value || typeof value !== "object") return false;
  return (
    value.version === MEMORY_VERSION &&
    typeof value.revision === "number" &&
    typeof value.updatedAt === "string" &&
    typeof value.profile === "object" &&
    Array.isArray(value.facts) &&
    Array.isArray(value.episodes)
  );
}

async function loadMemoryV2(userId: string): Promise<MemoryV2 | null> {
  const getElapsed = startTimer();
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: getMemoryKey(userId) }));
    const raw = (await res.Body?.transformToString("utf-8")) ?? null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isMemoryV2(parsed)) {
      logError("memory.load_raw.invalid_schema", "memoryService.loadMemoryV2", "Invalid schema", {
        userId,
        durationMs: getElapsed(),
      });
      return null;
    }
    logInfo("memory.load_raw.completed", "memoryService.loadRaw", {
      userId,
      durationMs: getElapsed(),
      found: true,
      bytes: raw.length,
      revision: parsed.revision,
      factCount: parsed.facts.length,
      episodeCount: parsed.episodes.length,
    });
    return parsed;
  } catch (e: unknown) {
    if ((e as { name?: string }).name === "NoSuchKey") {
      logInfo("memory.load_raw.not_found", "memoryService.loadMemoryV2", {
        userId,
        durationMs: getElapsed(),
      });
      return null;
    }
    logError("memory.load_raw.failed", "memoryService.loadMemoryV2", e, {
      userId,
      durationMs: getElapsed(),
    });
    throw e;
  }
}

export async function loadMemories(userId: string): Promise<LoadedMemories> {
  const getElapsed = startTimer();
  const memory = (await loadMemoryV2(userId)) ?? createEmptyMemory();
  const profileText =
    Object.keys(memory.profile).length > 0 ? serializeProfile(memory.profile) : null;
  const memories = buildLaunchMemoriesText(memory);
  const payload = toPromptPayload(memory);
  if (!profileText && !memories) {
    logInfo("memory.load.completed", "memoryService.loadMemories", {
      userId,
      durationMs: getElapsed(),
      hasProfile: false,
      hasMemories: false,
    });
    return { profile: null, memories: null, memoryPayload: null };
  }

  logInfo("memory.load.completed", "memoryService.loadMemories", {
    userId,
    durationMs: getElapsed(),
    hasProfile: Boolean(profileText),
    hasMemories: Boolean(memories),
    memoryChars: memories?.length ?? 0,
    profileChars: profileText?.length ?? 0,
    factCount: payload.facts.length,
    episodeCount: payload.episodes.length,
  });
  return { profile: profileText, memories, memoryPayload: payload };
}

export function parseProfile(profileText: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of profileText.split("\n")) {
    const match = line.match(/^(.+?): (.+)$/);
    if (match) {
      entries[match[1]] = match[2];
    }
  }
  return entries;
}

export function serializeProfile(profile: Record<string, string>): string {
  return Object.entries(profile)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function mergeFacts(
  existing: MemoryFact[],
  incoming: ExtractedFact[],
  timestamp: string,
): MemoryFact[] {
  const merged = new Map<string, MemoryFact>();
  for (const fact of existing) {
    const key = `${fact.category.toLowerCase()}::${normalizeFactContent(fact.content)}`;
    merged.set(key, fact);
  }
  for (const fact of incoming) {
    const category = fact.category.trim();
    const content = fact.content.trim();
    if (!category || !content) continue;
    if (isSensitiveFact(category, content)) continue;
    const key = `${category.toLowerCase()}::${normalizeFactContent(content)}`;
    const candidate: MemoryFact = {
      id: createFactId(),
      category,
      content,
      confidence: clampConfidence(fact.confidence),
      timestamp,
      source: "session",
    };
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, candidate);
      continue;
    }
    const nextTimestamp = parseTimestampMs(candidate.timestamp) > parseTimestampMs(prev.timestamp);
    merged.set(key, {
      ...prev,
      content: nextTimestamp ? candidate.content : prev.content,
      confidence: Math.max(prev.confidence, candidate.confidence),
      timestamp: nextTimestamp ? candidate.timestamp : prev.timestamp,
      source: nextTimestamp ? candidate.source : prev.source,
    });
  }
  return sortByTimestampDesc([...merged.values()]).slice(0, MAX_FACTS);
}

export async function saveMemory(
  userId: string,
  summary: string,
  profileUpdates?: Record<string, string>,
  facts?: ExtractedFact[],
): Promise<void> {
  const getElapsed = startTimer();
  const getLoadElapsed = startTimer();
  const loadedA = (await loadMemoryV2(userId)) ?? createEmptyMemory();
  const loadedB = (await loadMemoryV2(userId)) ?? loadedA;
  const staleDetected = loadedA.revision !== loadedB.revision;
  const current = staleDetected ? loadedB : loadedA;
  const now = formatJSTDate();

  const next: MemoryV2 = {
    version: MEMORY_VERSION,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    profile: { ...current.profile, ...(profileUpdates ?? {}) },
    facts: mergeFacts(current.facts, facts ?? [], now),
    episodes: sortByTimestampDesc([...current.episodes, { timestamp: now, summary }]).slice(
      0,
      MAX_EPISODES,
    ),
  };

  const finalBody = JSON.stringify(next);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: getMemoryKey(userId),
      Body: finalBody,
      ContentType: "application/json; charset=utf-8",
    }),
  );
  logInfo("memory.save.completed", "memoryService.saveMemory", {
    userId,
    durationMs: getElapsed(),
    loadDurationMs: getLoadElapsed(),
    staleDetected,
    revision: next.revision,
    summaryChars: summary.length,
    profileUpdateCount: Object.keys(profileUpdates ?? {}).length,
    factCount: next.facts.length,
    addedFactCount: facts?.length ?? 0,
    episodeCount: next.episodes.length,
    totalChars: finalBody.length,
  });
}

export function trimMemoriesForPrompt(memories: string): string {
  if (memories.length <= MAX_PROMPT_CHARS) return memories;
  return memories.slice(0, MAX_PROMPT_CHARS);
}
