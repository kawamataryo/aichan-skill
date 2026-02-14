import type { RequestEnvelope } from "ask-sdk-model";

const FALLBACK_ID = "_shared";

export function getUserId(requestEnvelope: RequestEnvelope): string {
  const personId = requestEnvelope.context.System.person?.personId;
  if (personId) return personId;

  const userId = requestEnvelope.context.System.user?.userId;
  if (userId) return userId;

  return FALLBACK_ID;
}
