import { checkAndIncrementRateLimit } from "@/lib/redis";

function buildRateLimitMessage(blockedBy?: string, cooldownSeconds?: number): string {
  if (blockedBy === "minute") {
    return "Çok hızlı mesaj gönderiyorsunuz. Lütfen 1 dakika sonra tekrar yazın.";
  }
  if (blockedBy === "hour" || blockedBy === "cooldown") {
    const mins = cooldownSeconds ? Math.ceil(cooldownSeconds / 60) : 180;
    return `Yoğunluk koruması devrede. Lütfen yaklaşık ${mins} dakika sonra tekrar yazın veya işletmeyi telefonla arayın.`;
  }
  if (blockedBy === "day") {
    return "Günlük mesaj limitine ulaşıldı. Lütfen yarın tekrar deneyin veya işletmeyi doğrudan arayın.";
  }
  return "Çok fazla mesaj gönderdiniz, lütfen biraz bekleyin.";
}

/**
 * Çok katmanlı anti-wallet koruması:
 * - dakika limiti
 * - saatlik limit + geçici soğutma
 * - günlük limit
 * Limit aşımında { allowed: false, message } döner ve loglanır.
 */
export async function enforceRateLimit(phone: string): Promise<
  | { allowed: true }
  | { allowed: false; message: string }
> {
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) {
    return { allowed: true };
  }
  const result = await checkAndIncrementRateLimit(phone);
  const { allowed } = result;
  if (!allowed) {
    console.warn("[rateLimit] Limit exceeded", {
      phone: normalized,
      blockedBy: result.blockedBy,
      minute: result.minuteCount,
      hour: result.hourCount,
      day: result.dayCount,
    });
    return {
      allowed: false,
      message: buildRateLimitMessage(result.blockedBy, result.cooldownSeconds),
    };
  }
  return { allowed: true };
}
