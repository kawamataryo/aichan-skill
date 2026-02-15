type LogLevel = "INFO" | "ERROR";

interface LogPayload {
  level: LogLevel;
  event: string;
  component: string;
  timestamp: string;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeSerialize(payload: LogPayload): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      level: "ERROR",
      event: "logger.serialize.failed",
      component: "structuredLogger",
      timestamp: nowIso(),
    });
  }
}

function elapsedMs(startAt: number): number {
  return Number((performance.now() - startAt).toFixed(1));
}

export function logInfo(
  event: string,
  component: string,
  fields: Record<string, unknown> = {},
): void {
  const payload: LogPayload = {
    level: "INFO",
    event,
    component,
    timestamp: nowIso(),
    ...fields,
  };
  console.log(safeSerialize(payload));
}

export function logError(
  event: string,
  component: string,
  error: unknown,
  fields: Record<string, unknown> = {},
): void {
  const errorObject = error instanceof Error ? error : undefined;
  const payload: LogPayload = {
    level: "ERROR",
    event,
    component,
    timestamp: nowIso(),
    errorName: errorObject?.name ?? "UnknownError",
    errorMessage: errorObject?.message ?? String(error),
    ...fields,
  };
  console.error(safeSerialize(payload));
}

export function startTimer(): () => number {
  const startedAt = performance.now();
  return () => elapsedMs(startedAt);
}
