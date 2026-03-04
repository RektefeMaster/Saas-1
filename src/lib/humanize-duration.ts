/**
 * humanize-duration: Süreleri okunabilir formata çevirir.
 * 90 dakika → "1 saat 30 dakika", 30 dakika → "30 dakika"
 */
import humanizeDuration from "humanize-duration";

const trHumanizer = humanizeDuration.humanizer({
  language: "tr",
  largest: 2, // En fazla 2 birim göster (1 saat 30 dakika)
  round: true,
  units: ["y", "mo", "w", "d", "h", "m"],
});

/**
 * Dakika cinsinden süreyi Türkçe okunabilir formata çevirir.
 * @param minutes - Dakika (örn: 30, 90, 120)
 * @returns "30 dakika", "1 saat 30 dakika", "2 saat" vb.
 */
export function humanizeMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  const ms = minutes * 60 * 1000;
  return trHumanizer(ms);
}
