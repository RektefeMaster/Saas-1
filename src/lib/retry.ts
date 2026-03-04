/**
 * p-retry: Dış API çağrıları için exponential backoff.
 * Supabase, WhatsApp, OpenAI gibi servislerde anlık ağ hatalarını otomatik atlatır.
 */
import ms from "ms";
import pRetry, { type Options } from "p-retry";

const DEFAULT_OPTIONS: Options = {
  retries: 4,
  minTimeout: ms("500ms"),
  maxTimeout: ms("8s"),
  factor: 2,
  onFailedAttempt: (err) => {
    console.warn(
      `[retry] Deneme ${err.attemptNumber}/${err.retriesLeft + err.attemptNumber} başarısız:`,
      err.error?.message ?? err.error
    );
  },
};

/**
 * Fonksiyonu exponential backoff ile sarmalar.
 * Hata olursa 0.5s, 1s, 2s, 4s bekleyip tekrar dener.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<Options>
): Promise<T> {
  return pRetry(fn, { ...DEFAULT_OPTIONS, ...options });
}
