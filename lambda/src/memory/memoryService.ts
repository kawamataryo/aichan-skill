import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { consolidateMemories } from "./summarize";

const s3 = new S3Client({});
const BUCKET = process.env.MEMORY_BUCKET!;
const KEY = "memories.txt";
const SECTION_SEPARATOR = "\n---\n";
const MAX_RECENT_SECTIONS = 10;
const MAX_PROMPT_CHARS = 4000;

export async function loadMemories(): Promise<string | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    return (await res.Body?.transformToString("utf-8")) ?? null;
  } catch (e: unknown) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
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

function parseSections(text: string): { longTermMemory: string | null; recentSections: string[] } {
  const parts = text.split(SECTION_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { longTermMemory: null, recentSections: [] };

  if (parts[0].startsWith("[長期記憶]")) {
    return { longTermMemory: parts[0], recentSections: parts.slice(1) };
  }
  return { longTermMemory: null, recentSections: parts };
}

function buildMemoryText(longTermMemory: string | null, recentSections: string[]): string {
  const parts = longTermMemory ? [longTermMemory, ...recentSections] : recentSections;
  return parts.join(SECTION_SEPARATOR);
}

export async function saveMemory(summary: string): Promise<void> {
  const existing = await loadMemories();
  const { longTermMemory, recentSections } = existing ? parseSections(existing) : { longTermMemory: null, recentSections: [] };

  const newSection = `[${formatJSTDate()}]\n${summary}`;
  recentSections.push(newSection);

  let updatedLongTerm = longTermMemory;
  let updatedRecent = recentSections;

  if (recentSections.length > MAX_RECENT_SECTIONS) {
    const overflow = recentSections.slice(0, recentSections.length - MAX_RECENT_SECTIONS);
    updatedRecent = recentSections.slice(recentSections.length - MAX_RECENT_SECTIONS);
    updatedLongTerm = await consolidateMemories(longTermMemory, overflow);
  }

  const finalText = buildMemoryText(updatedLongTerm, updatedRecent);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: KEY, Body: finalText, ContentType: "text/plain; charset=utf-8" }));
}

export function trimMemoriesForPrompt(memories: string): string {
  if (memories.length <= MAX_PROMPT_CHARS) return memories;

  const { longTermMemory, recentSections } = parseSections(memories);
  const parts = longTermMemory ? [longTermMemory] : [];

  for (let i = recentSections.length - 1; i >= 0; i--) {
    const candidate = [...parts.slice(0, 1), recentSections[i], ...parts.slice(1)];
    if (longTermMemory) {
      candidate.splice(0, 1, longTermMemory);
      candidate.splice(1, 0, ...recentSections.slice(i));
      const text = candidate.join(SECTION_SEPARATOR);
      if (text.length <= MAX_PROMPT_CHARS) {
        return text;
      }
    } else {
      const text = recentSections.slice(i).join(SECTION_SEPARATOR);
      if (text.length <= MAX_PROMPT_CHARS) return text;
    }
  }

  return longTermMemory ? longTermMemory.slice(0, MAX_PROMPT_CHARS) : memories.slice(0, MAX_PROMPT_CHARS);
}
