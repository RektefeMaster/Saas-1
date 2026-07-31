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

/**
 * Bilgi sorusu mu? ("iptal koşullarınız nedir?", "gecikirsem ne olur?")
 * Bu tür mesajlar aksiyon tetiklememeli, LLM cevaplamalı.
 */
function isInformationalQuestion(text: string): boolean {
  return (
    /\b(nedir|ne\s*olur|ne\s*oluyor|nasil|kosul|kosullar|politika|kural|ceza|ucret\s*var|para\s*iadesi|mumkun\s*mu|olur\s*mu|gerekir\s*mi)\b/.test(
      text
    ) || /\b(eger|sayet)\b/.test(text)
  );
}

/** Olumsuzlama: "iptal etmek istemiyorum", "iptal ettirmemem lazım" */
function isNegated(text: string): boolean {
  if (
    /\b(istemiyorum|istemem|etmeyeyim|etmeyin|olmasin|gerek\s*yok|vazgectim)\b/.test(text)
  ) {
    return true;
  }
  // "etmeme / ettirmeme" kökleri olumsuzdur; "etmek / ettirmek" ise değildir.
  return /(etmeme|ettirmeme|etmiyorum|ettirmiyorum)/.test(text);
}

export function detectDeterministicIntent(message: string): DeterministicIntent {
  const text = normalize(message).replace(/\s+/g, " ");

  // Soru veya olumsuz cümlelerde hiçbir aksiyon tetikleme.
  if (isInformationalQuestion(text) || isNegated(text)) return null;

  // Delay intent gets priority over cancel to avoid false cancellation
  // on phrases like "trafikteyim, biraz gecikecegim".
  // Birinci tekil şahıs kalıpları: müşteri KENDİ gecikmesini bildirmeli.
  const latePatterns = [
    /\bgec\s*kal(acagim|iyorum|irim|acaz)\b/,
    /\bgecik(ecegim|iyorum|tim|ecegiz)\b/,
    /\btrafik(teyim|te\s*kaldim|e\s*takildim)\b/,
    /\bbiraz\s*gec\s*(gelecegim|kalacagim|geliyorum)\b/,
    /\bgec\s*gel(ecegim|iyorum|ecegiz)\b/,
  ];
  if (latePatterns.some((p) => p.test(text))) {
    const parsed = parseDelayMinutes(text);
    return { type: "late", minutes: parsed ?? 15 };
  }

  const cancelPatterns = [
    /\b(randevu(mu|yu|sunu)?\s*)?iptal\s*(et|edin|edelim|edebilir|ediyorum|edeyim)\b/,
    /\biptal\s*etmek\s*istiyorum\b/,
    /\brandevu(mu|yu)\s*iptal\b/,
    /\bgelem(eyecegim|icem|em|iyorum)\b/,
    /\bgelmeyecegim\b/,
    /\byetisem(eyecegim|iyorum)\b/,
    /\bkatilamayacagim\b/,
  ];
  if (cancelPatterns.some((p) => p.test(text))) {
    return { type: "cancel" };
  }

  return null;
}
