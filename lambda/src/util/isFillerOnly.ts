const FILLERS = [
  "え",
  "えー",
  "えっと",
  "えーっと",
  "あの",
  "あのー",
  "うーん",
  "んー",
  "その",
  "そのー",
  "なんか",
  "まあ",
  "うん",
  "うーんと",
  "えーと",
] as const;

function normalizeJa(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ 　\t\n\r]/g, "")
    .replace(/[ー〜~]/g, "")
    .replace(/[、。,.!！?？]/g, "")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NORMALIZED_FILLERS = FILLERS.map((filler) => normalizeJa(filler));

export function isFillerOnly(raw: string): boolean {
  const normalized = normalizeJa(raw ?? "");
  if (!normalized) return true;

  const removed = NORMALIZED_FILLERS.reduce((acc, filler) => {
    const pattern = new RegExp(escapeRegExp(filler), "g");
    return acc.replace(pattern, "");
  }, normalized);

  return removed.length === 0;
}
