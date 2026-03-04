/**
 * slugify: URL-safe string üretir.
 * Türkçe karakter desteği (ü→u, ö→o, ı→i, ğ→g, ş→s, ç→c).
 */
import slugifyLib from "slugify";

export function slugify(value: string, maxLength = 120): string {
  if (!value || typeof value !== "string") return "";
  const slug = slugifyLib(value.trim(), {
    replacement: "-",
    lower: true,
    strict: true,
    locale: "tr",
    trim: true,
  });
  return slug.slice(0, maxLength).replace(/^-+|-+$/g, "");
}
