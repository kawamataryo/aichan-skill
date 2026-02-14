import { createProviderRegistry } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export const registry = createProviderRegistry({
  google,
  openai,
  anthropic,
});

export const MODEL_ALIASES: Record<string, { modelId: string; displayName: string }> = {
  ジェミニ: { modelId: "google:gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
  GPT: { modelId: "openai:gpt-4o", displayName: "GPT-4o" },
  クロード: { modelId: "anthropic:claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5" },
};

const DEFAULT_MODEL = "google:gemini-2.5-flash";

export function getModel(modelId?: string) {
  const id = modelId ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
  return registry.languageModel(id as Parameters<typeof registry.languageModel>[0]);
}

export function getDisplayName(modelId: string): string {
  const entry = Object.values(MODEL_ALIASES).find((e) => e.modelId === modelId);
  return entry?.displayName ?? modelId;
}
