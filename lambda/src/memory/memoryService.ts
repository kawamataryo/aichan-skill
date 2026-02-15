import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { consolidateMemories } from "./summarize";
import { logError, logInfo, startTimer } from "../util/structuredLogger";

const s3 = new S3Client({});
const BUCKET = process.env.MEMORY_BUCKET!;

function getMemoryKey(userId: string): string {
  return `memories/${userId}.txt`;
}
const SECTION_SEPARATOR = "\n---\n";
const MAX_RECENT_SECTIONS = 10;
const MAX_PROMPT_CHARS = 4000;

export interface LoadedMemories {
  profile: string | null;
  memories: string | null;
}

async function loadRaw(userId: string): Promise<string | null> {
  const getElapsed = startTimer();
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: getMemoryKey(userId) }));
    const raw = (await res.Body?.transformToString("utf-8")) ?? null;
    logInfo("memory.load_raw.completed", "memoryService.loadRaw", {
      userId,
      durationMs: getElapsed(),
      found: Boolean(raw),
      bytes: raw?.length ?? 0,
    });
    return raw;
  } catch (e: unknown) {
    if ((e as { name?: string }).name === "NoSuchKey") {
      logInfo("memory.load_raw.not_found", "memoryService.loadRaw", {
        userId,
        durationMs: getElapsed(),
      });
      return null;
    }
    logError("memory.load_raw.failed", "memoryService.loadRaw", e, {
      userId,
      durationMs: getElapsed(),
    });
    throw e;
  }
}

export async function loadMemories(userId: string): Promise<LoadedMemories> {
  const getElapsed = startTimer();
  const raw = await loadRaw(userId);
  if (!raw) {
    logInfo("memory.load.completed", "memoryService.loadMemories", {
      userId,
      durationMs: getElapsed(),
      hasProfile: false,
      hasMemories: false,
    });
    return { profile: null, memories: null };
  }

  const { profile, rest } = extractProfile(raw);
  logInfo("memory.load.completed", "memoryService.loadMemories", {
    userId,
    durationMs: getElapsed(),
    hasProfile: Boolean(profile),
    hasMemories: Boolean(rest),
    memoryChars: rest.length,
    profileChars: profile?.length ?? 0,
  });
  return { profile, memories: rest || null };
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

function extractProfile(text: string): { profile: string | null; rest: string } {
  const parts = text
    .split(SECTION_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length > 0 && parts[0].startsWith("[プロファイル]")) {
    const profileSection = parts[0];
    const profile = profileSection.replace(/^\[プロファイル\]\n?/, "").trim();
    const rest = parts.slice(1).join(SECTION_SEPARATOR);
    return { profile: profile || null, rest };
  }
  return { profile: null, rest: text };
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

function mergeProfile(
  existingProfileText: string | null,
  updates: Record<string, string>,
): string | null {
  if (Object.keys(updates).length === 0 && !existingProfileText) return null;
  const existing = existingProfileText ? parseProfile(existingProfileText) : {};
  const merged = { ...existing, ...updates };
  if (Object.keys(merged).length === 0) return null;
  return serializeProfile(merged);
}

function parseSections(text: string): { longTermMemory: string | null; recentSections: string[] } {
  const parts = text
    .split(SECTION_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { longTermMemory: null, recentSections: [] };

  if (parts[0].startsWith("[長期記憶]")) {
    return { longTermMemory: parts[0], recentSections: parts.slice(1) };
  }
  return { longTermMemory: null, recentSections: parts };
}

function buildMemoryText(
  profile: string | null,
  longTermMemory: string | null,
  recentSections: string[],
): string {
  const parts: string[] = [];
  if (profile) {
    parts.push(`[プロファイル]\n${profile}`);
  }
  if (longTermMemory) {
    parts.push(longTermMemory);
  }
  parts.push(...recentSections);
  return parts.join(SECTION_SEPARATOR);
}

export async function saveMemory(
  userId: string,
  summary: string,
  profileUpdates?: Record<string, string>,
): Promise<void> {
  const getElapsed = startTimer();
  const raw = await loadRaw(userId);
  const { profile: existingProfile, rest } = raw
    ? extractProfile(raw)
    : { profile: null, rest: "" };
  const { longTermMemory, recentSections } = rest
    ? parseSections(rest)
    : { longTermMemory: null, recentSections: [] };

  const newSection = `[${formatJSTDate()}]\n${summary}`;
  recentSections.push(newSection);

  let updatedLongTerm = longTermMemory;
  let updatedRecent = recentSections;

  if (recentSections.length > MAX_RECENT_SECTIONS) {
    const overflow = recentSections.slice(0, recentSections.length - MAX_RECENT_SECTIONS);
    updatedRecent = recentSections.slice(recentSections.length - MAX_RECENT_SECTIONS);
    updatedLongTerm = await consolidateMemories(longTermMemory, overflow);
  }

  const updatedProfile = mergeProfile(existingProfile, profileUpdates ?? {});

  const finalText = buildMemoryText(updatedProfile, updatedLongTerm, updatedRecent);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: getMemoryKey(userId),
      Body: finalText,
      ContentType: "text/plain; charset=utf-8",
    }),
  );
  logInfo("memory.save.completed", "memoryService.saveMemory", {
    userId,
    durationMs: getElapsed(),
    summaryChars: summary.length,
    profileUpdateCount: Object.keys(profileUpdates ?? {}).length,
    recentSectionCount: updatedRecent.length,
    hasLongTermMemory: Boolean(updatedLongTerm),
    totalChars: finalText.length,
  });
}

export function trimMemoriesForPrompt(memories: string): string {
  if (memories.length <= MAX_PROMPT_CHARS) return memories;

  const { longTermMemory, recentSections } = parseSections(memories);

  for (let i = recentSections.length - 1; i >= 0; i--) {
    if (longTermMemory) {
      const text = [longTermMemory, ...recentSections.slice(i)].join(SECTION_SEPARATOR);
      if (text.length <= MAX_PROMPT_CHARS) {
        return text;
      }
    } else {
      const text = recentSections.slice(i).join(SECTION_SEPARATOR);
      if (text.length <= MAX_PROMPT_CHARS) return text;
    }
  }

  return longTermMemory
    ? longTermMemory.slice(0, MAX_PROMPT_CHARS)
    : memories.slice(0, MAX_PROMPT_CHARS);
}
