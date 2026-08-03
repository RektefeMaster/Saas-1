import {
  normalizeIncomingText,
} from "./normalizers";
import {
  BUSINESS_SCOPE_KEYWORDS,
  ABUSIVE_KEYWORDS,
  ABUSIVE_STEMS,
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

/**
 * Kök + Türkçe ek eşleşmesi. Türkçe eklemeli bir dil: "yetkili" → "yetkiliye",
 * "yetkiliyle", "yetkilinizi". `containsWord` kelime sonunda da sınır aradığı
 * için bu biçimlerin HİÇBİRİNİ yakalamıyordu — müşteri "yetkiliye bağlayın"
 * yazdığında insan aktarımı hiç tetiklenmiyordu.
 *
 * Kelime BAŞI sınırı korunur (yanlış ön-ek eşleşmesi olmasın), sonda ek serbest.
 * Bu yüzden köklerin kısa ve çift anlamlı olmaması gerekir: "sik" kökü
 * "sıkıldım"ı da yakalar, o yüzden böyle kökler listeye KONULMAZ.
 */
export function containsStem(text: string, stems: readonly string[]): boolean {
  if (!text) return false;
  return stems.some((stem) => {
    const escaped = stem
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    if (!escaped) return false;
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}\\p{L}*`, "u").test(text);
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
  // Tam kelime: kısa/çift anlamlı olanlar ("pic") yalnızca kelime sınırıyla.
  if (containsWord(text, ABUSIVE_KEYWORDS)) return true;
  // Kök + ek: "salaksın", "aptalsın", "gerizekalısın" eskiden kaçıyordu.
  return containsStem(text, ABUSIVE_STEMS);
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

/**
 * İnsan talebi kökleri. Ek toleranslı eşleşir (bkz. containsStem):
 * "yetkiliye", "operatöre", "canlı desteğe", "gerçek kişiyle".
 *
 * "canli deste" bilerek kısa: Türkçede k→ğ yumuşaması var (destek → desteğe),
 * "destek" kökü "desteğe"yi yakalayamaz.
 *
 * "mudur" listeye KONULMAZ: "uygun mudur?" gibi soru ekiyle çakışıyor.
 */
const HUMAN_ESCALATION_STEMS = [
  "yetkili",
  "operator",
  "canli deste",
  "gercek kisi",
  "musteri hizmet",
  "insan deste",
  "patron",
  "isletme sahib",
] as const;

function hasHumanEscalationToken(text: string): boolean {
  // text is already normalizeIncomingText (ASCII-folded).
  if (containsStem(text, HUMAN_ESCALATION_STEMS)) return true;
  return (
    /\bbiriyle\s*gorus/.test(text) ||
    // "bir insanla görüşebilir miyim", "insanla konuşmak istiyorum"
    /\binsan\p{L}*\s*(?:ile\s*)?(?:gorus|konus|baglan)/u.test(text) ||
    /\binsan\s*(mi|misiniz|misin|yonlendir)\b/.test(text)
  );
}

/**
 * "Neden insana aktardın?" gibi eskalasyon SORUSU.
 *
 * Eskiden `text.includes("usta")` kullanılıyordu; substring olduğu için
 * "Mustafa" ismini de yakalıyordu — "ben Mustafa, randevumu aktarır mısın"
 * yazan müşteriye randevu yerine "insan desteği önermiştim" cevabı gidiyordu.
 */
export function isEscalationQuestion(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!hasHumanEscalationToken(text) && !containsStem(text, ["usta"])) {
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

  // `hasHumanEscalationToken` ile AYNI kaynağı kullanır. Eskiden buraya ekstra
  // `text.includes("yetkili")` konulmuştu; bu yüzden "yetkiliye bağlayın" burada
  // HUMAN_REQUEST görünüyor (ve test yeşil kalıyor) ama processor'ın gerçekten
  // aktarım yaptığı `isHumanEscalationRequest` false dönüyordu.
  if (hasHumanEscalationToken(text)) {
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


/**
 * Mesaj, iptal onayının yanında AYRICA yeni randevu talebi de taşıyor mu?
 * ("evet iptal et ve bugün 12'ye al", "iptal edip yarına alalım")
 * Saat/tarih sinyali + alma fiili birlikte aranır; tek başına "iptal" yeterli değil.
 */
export function hasReschedulingIntent(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  const hasTimeOrDate =
    // Ek almış saatler de sayılır: "15e", "12'ye" → sondaki \b aranmaz.
    /\b\d{1,2}([:.]\d{2})?/.test(text) ||
    // Türkçe ek alan biçimler ("yarina", "cumaya", "pazartesiye") için kök eşleşmesi.
    /\b(bugun|yarin|obur\s*gun|pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar|hafta)/.test(
      text
    );
  const hasBookingVerb =
    /\b(al|alalim|alir\s*misin|alabilir|yaz|yazalim|ayarla|ayarlayalim|tasi|tasiyalim|kaydet)\b/.test(
      text
    );
  return hasTimeOrDate && hasBookingVerb;
}
