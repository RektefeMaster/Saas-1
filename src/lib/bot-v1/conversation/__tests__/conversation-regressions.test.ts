/**
 * Canlı test konuşmalarında yakalanan hatalar için regresyon testleri.
 * Her başlık gerçek bir WhatsApp sohbetinde görülen davranışa karşılık gelir.
 */
import { describe, it, expect } from "vitest";
import { detectGlobalInterruptIntent, hasReschedulingIntent } from "../intent-detection";
import { formatDateReadableTr } from "../helpers";
import { fillTemplate } from "@/services/configMerge.service";

describe("akış iptali (boşver/vazgeçtim)", () => {
  it("tek başına 'boşver' akışı kapatır", () => {
    expect(detectGlobalInterruptIntent("boşver")).toBe("CANCEL_FLOW");
    expect(detectGlobalInterruptIntent("vazgeçtim")).toBe("CANCEL_FLOW");
    expect(detectGlobalInterruptIntent("boşver ya")).toBe("CANCEL_FLOW");
  });

  it("içinde randevu talebi olan cümlede akışı SİLMEZ", () => {
    // Gerçek vaka: müşteri randevuyu bugüne çekmek istiyordu, bot her şeyi sıfırladı.
    expect(detectGlobalInterruptIntent("Bugüne alalım ya boşver")).not.toBe("CANCEL_FLOW");
    expect(detectGlobalInterruptIntent("boşver yarına randevu alalım")).not.toBe(
      "CANCEL_FLOW"
    );
  });

  it("uzun cümlelerde tek kelimeye bakıp akışı silmez", () => {
    expect(
      detectGlobalInterruptIntent(
        "aslında dün de aramıştım ama vazgeçtim sonra tekrar düşündüm"
      )
    ).not.toBe("CANCEL_FLOW");
  });

  it("kelime sınırı: 'boşvermek istemiyorum' gibi ifadede tetiklenmez", () => {
    expect(detectGlobalInterruptIntent("randevumu boşvermek istemiyorum")).not.toBe(
      "CANCEL_FLOW"
    );
  });

  it("insan talebi ve reset davranışı korunur", () => {
    expect(detectGlobalInterruptIntent("yetkiliye bağlayın")).toBe("HUMAN_REQUEST");
    expect(detectGlobalInterruptIntent("sıfırla")).toBe("RESET");
  });
});

describe("onay mesajında saat tekrarı", () => {
  const template = "Tamam! {date} saat {time}de bekliyoruz.";

  it("{date} saat içermez; şablonla birleşince saat iki kez yazılmaz", () => {
    const dateOnly = formatDateReadableTr("2026-08-01");
    expect(dateOnly).not.toMatch(/saat/);

    const text = fillTemplate(template, { date: dateOnly, time: "15:00" });
    // Gerçek hata: "yarın 1 Ağustosta saat 15.00'a saat 15:00de bekliyoruz"
    expect(text.match(/saat/g)?.length).toBe(1);
    expect(text).toContain("15:00");
    expect(text).not.toContain("15.00");
  });

  it("saatli okunabilir form ayrı olarak hâlâ üretilebiliyor", () => {
    const withTime = formatDateReadableTr("2026-08-01", "15:00");
    expect(withTime).toMatch(/saat/);
    expect(withTime).toContain("15.00");
  });
});

describe("aynı mesajda iptal + yeni randevu", () => {
  it("iptal onayının yanındaki saat/tarih talebini yakalar", () => {
    expect(hasReschedulingIntent("Evet iptal et ve bugün saat 12 ye al")).toBe(true);
    expect(hasReschedulingIntent("iptal edip yarına alalım")).toBe(true);
    expect(hasReschedulingIntent("evet iptal, cuma 15e yaz")).toBe(true);
  });

  it("sade iptal onayında tetiklenmez (akış kesilsin)", () => {
    expect(hasReschedulingIntent("evet iptal")).toBe(false);
    expect(hasReschedulingIntent("iptal et")).toBe(false);
    expect(hasReschedulingIntent("evet")).toBe(false);
  });
});
