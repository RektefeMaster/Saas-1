export type DeterministicIntent =
  | { type: "cancel" }
  | { type: "late"; minutes: number }
  | null;

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function parseDelayMinutes(text: string): number | null {
  const m = text.match(/(\d{1,3})\s*(dk|dakika|min)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.min(180, Math.max(1, n));
}

export function detectDeterministicIntent(message: string): DeterministicIntent {
  const text = normalize(message);

  // Delay intent gets priority over cancel to avoid false cancellation
  // on phrases like "trafikteyim, biraz gecikecegim".
  const latePatterns = [
    "gec kal",
    "gecik",
    "trafik",
    "biraz gec",
    "gec gelecegim",
  ];
  if (latePatterns.some((p) => text.includes(p))) {
    const parsed = parseDelayMinutes(text);
    return { type: "late", minutes: parsed ?? 15 };
  }

  const cancelPatterns = [
    "iptal",
    "gelemeyecegim",
    "gelemicem",
    "gelemem",
    "gelmeyecegim",
    "vazgectim",
    "baska zaman",
    "yetisemeyecegim",
    "is cikt",
  ];
  if (cancelPatterns.some((p) => text.includes(p))) {
    return { type: "cancel" };
  }

  return null;
}
