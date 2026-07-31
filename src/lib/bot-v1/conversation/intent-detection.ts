import {
  normalizeIncomingText,
} from "./normalizers";
import {
  BUSINESS_SCOPE_KEYWORDS,
  ABUSIVE_KEYWORDS,
  GREETING_KEYWORDS,
  SMALLTALK_KEYWORDS,
} from "./constants";

/**
 * Kelime sınırıyla eşleşme. `text.includes(word)` Türkçede sık yanlış eşleşir
 * ("başka" ve "maske" içinde "ask" geçer). Çok kelimeli ifadelerde ifadenin
 * tamamı kelime sınırları arasında aranır.
 */
export function containsWord(text: string, words: readonly string[]): boolean {
  if (!text) return false;
  return words.some((word) => {
    const escaped = word
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    if (!escaped) return false;
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "u").test(text);
  });
}

export function isAskNameIntent(message: string): boolean {
  const text = normalizeIncomingText(message);
  return (
    text.includes("ismim ne") ||
    text.includes("adim ne") ||
    text.includes("adimi biliyor musun") ||
    text.includes("beni hangi isimle kaydettin")
  );
}

/**
 * AÇIK iptal onayı. Çıplak "evet"/"tamam" BURAYA GİRMEZ — yanlışlıkla randevu
 * iptaline sebep oluyordu. Kısa onaylar için isSoftAffirmation kullanılır ve o da
 * yalnızca açık iptal talebiyle başlatılmış bir onay beklemesinde geçerlidir.
 */
export function isCancelConfirmation(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  if (isCancelReject(text)) return false;
  return (
    /\biptal\s*(et|edin|edelim|ediyorum|olsun)\b/.test(text) ||
    /\b(evet|tamam|olur|onay(li)?)\s*,?\s*iptal\b/.test(text) ||
    /\biptal[ie]?\s*(onayliyorum|onay)\b/.test(text) ||
    text === "iptal onay" ||
    text === "onayliyorum"
  );
}

/**
 * "evet / tamam / olur" gibi kısa onaylar. Tek başına yıkıcı bir işlem
 * tetiklememeli; yalnızca açık bir onay bekleme bağlamında anlamlıdır.
 */
export function isSoftAffirmation(message: string): boolean {
  const text = normalizeIncomingText(message).replace(/[!.?]+$/g, "").trim();
  if (!text) return false;
  return [
    "evet",
    "e",
    "he",
    "hee",
    "tamam",
    "tamamdir",
    "olur",
    "onay",
    "onayliyorum",
    "ok",
    "okey",
    "peki",
    "kabul",
  ].includes(text);
}

export function isCancelReject(message: string): boolean {
  const text = normalizeIncomingText(message).replace(/[!.?]+$/g, "").trim();
  if (!text) return false;
  if (["hayir", "yok", "kalsin", "bosver", "vazgectim"].includes(text)) return true;
  return (
    /\biptal\s*(etme|etmek\s*istemiyorum|istemiyorum)\b/.test(text) ||
    /\bvazgectim\b/.test(text) ||
    /\b(gerek\s*yok|kalsin|dursun|devam\s*etsin)\b/.test(text) ||
    /\bistemiyorum\b/.test(text)
  );
}

export function isAbusiveMessage(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  // Word-boundary match avoids false positives ("almak", "normal", "plan").
  return containsWord(text, ABUSIVE_KEYWORDS);
}

/**
 * Mesaj SADECE selam/hatır sorma mı? "Merhaba, yarın yer var mı?" gibi içinde
 * gerçek bir talep olan mesajlar buraya girmemeli — eskiden giriyordu ve talep
 * tamamen düşüyordu.
 */
export function isGreetingOrSmallTalkOnly(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  if (containsWord(text, BUSINESS_SCOPE_KEYWORDS)) return false;

  const hadGreeting =
    containsWord(text, GREETING_KEYWORDS) || containsWord(text, SMALLTALK_KEYWORDS);
  if (!hadGreeting) return false;

  const stripped = text
    .replace(
      new RegExp(
        [...GREETING_KEYWORDS, ...SMALLTALK_KEYWORDS]
          .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
          .join("|"),
        "gu"
      ),
      " "
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  // Selamlamadan geriye anlamlı içerik kaldıysa bu "sadece selam" değildir.
  return stripped.length === 0;
}

function hasHumanEscalationToken(text: string): boolean {
  // text is already normalizeIncomingText (ASCII-folded).
  return (
    /\b(yetkili|operator|canli\s*destek)\b/.test(text) ||
    /\bgercek\s*kisi\b/.test(text) ||
    /\bmusteri\s*hizmet/.test(text) ||
    /\bbiriyle\s*gorusmek\b/.test(text) ||
    /\binsan\s*(destek|mi|misiniz|misin|yonlendir)\b/.test(text)
  );
}

export function isEscalationQuestion(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!hasHumanEscalationToken(text) && !text.includes("usta") && !text.includes("yetkili")) {
    return false;
  }
  return text.includes("neden") || text.includes("bagla") || text.includes("aktar");
}

export function isHumanEscalationRequest(text: string): boolean {
  const t = normalizeIncomingText(text);
  return hasHumanEscalationToken(t);
}

export type GlobalInterruptIntent =
  | "CANCEL_FLOW"
  | "RESET"
  | "ASK_FAQ"
  | "HUMAN_REQUEST";

/**
 * "boşver / vazgeçtim" akışı SIFIRLAR (seçili hizmet, tarih, isim silinir).
 * Bu yüzden yalnızca mesajın ana niyeti buysa tetiklenmeli.
 *
 * Gerçek vaka: "Bugüne alalım ya boşver" cümlesinde müşteri randevuyu bugüne
 * çekmek istiyordu; substring eşleşmesi tüm akışı kapatıp seçili hizmeti sildi
 * ve müşteri baştan anlatmak zorunda kaldı.
 */
const ABANDON_WORDS = ["vazgectim", "bosver", "bosverin", "bosverelim"];

/** Vazgeçme ifadesinin yanında anlam taşımayan dolgu sözcükleri. */
const ABANDON_FILLERS = ["ya", "artik", "iste", "hadi", "yani", "tamam", "peki", "he", "ee"];

function isAbandonFlowMessage(text: string): boolean {
  if (!containsWord(text, ABANDON_WORDS)) return false;
  // Mesajda hâlâ bir iş talebi varsa (randevu/saat/hizmet) akışı silme.
  if (containsWord(text, BUSINESS_SCOPE_KEYWORDS)) return false;

  // Vazgeçme + dolgu sözcükleri atıldığında geriye anlamlı içerik kalıyorsa
  // ("bugüne alalım ya boşver") müşteri akışı kapatmıyor, konuyu değiştiriyor.
  const stripped = [...ABANDON_WORDS, ...ABANDON_FILLERS]
    .reduce(
      (acc, word) =>
        acc.replace(
          new RegExp(`(?:^|[^\\p{L}\\p{N}])${word}(?:$|[^\\p{L}\\p{N}])`, "gu"),
          " "
        ),
      ` ${text} `
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  return stripped.length === 0;
}

export function detectGlobalInterruptIntent(message: string): GlobalInterruptIntent | null {
  const text = normalizeIncomingText(message);
  if (!text) return null;

  if (hasHumanEscalationToken(text) || text.includes("yetkili")) {
    return "HUMAN_REQUEST";
  }

  if (isAbandonFlowMessage(text)) {
    return "CANCEL_FLOW";
  }

  if (
    text.includes("sifirla") ||
    text.includes("sıfırla") ||
    text.includes("yeniden basla") ||
    text.includes("reset")
  ) {
    return "RESET";
  }

  if (
    text.includes("fiyat") ||
    text.includes("ucret") ||
    text.includes("ücret") ||
    text.includes("adres") ||
    text.includes("neredesiniz") ||
    text.includes("hizmet")
  ) {
    return "ASK_FAQ";
  }

  return null;
}

