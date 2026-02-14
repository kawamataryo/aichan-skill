import { createProviderRegistry } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

const registry = createProviderRegistry({
  google,
  openai,
  anthropic,
});

const DEFAULT_MODEL = "google:gemini-2.5-flash";

export function getModel() {
  const id = process.env.AI_MODEL ?? DEFAULT_MODEL;
  return registry.languageModel(id as Parameters<typeof registry.languageModel>[0]);
}
