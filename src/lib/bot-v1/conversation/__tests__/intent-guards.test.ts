import { describe, it, expect } from "vitest";
import {
  isCancelConfirmation,
  isSoftAffirmation,
  isCancelReject,
  isGreetingOrSmallTalkOnly,
  isOutOfScopeMessage,
  isAbusiveMessage,
  isNegotiationMessage,
  containsWord,
} from "../intent-detection";
import { detectDeterministicIntent } from "@/lib/intent";

/**
 * Bu testler gerçek müşteri mesajlarında yaşanan yanlış eşleşmeleri kilitler.
 * Hepsi daha önce üretimde yanlış davranıyordu.
 */

describe("containsWord", () => {
  it("substring yanlış eşleşmesi yapmaz", () => {
    // "baska" içinde "ask" geçer; substring araması bunu kapsam dışı sayıyordu.
    expect(containsWord("baska gun var mi", ["ask"])).toBe(false);
    expect(containsWord("maske yaptirmak istiyorum", ["ask"])).toBe(false);
    expect(containsWord("ask filmi izledim", ["ask"])).toBe(true);
  });

  it("çok kelimeli ifadeleri bütün olarak arar", () => {
    expect(containsWord("yarin yer var mi", ["yer var"])).toBe(true);
    expect(containsWord("yerimiz yok", ["yer var"])).toBe(false);
  });
});

describe("isCancelConfirmation", () => {
  it("çıplak onaylar iptal onayı SAYILMAZ", () => {
    // En kritik regresyon: "tamam" yazan müşterinin randevusu iptal oluyordu.
    for (const msg of ["tamam", "evet", "onay", "olur", "ok"]) {
      expect(isCancelConfirmation(msg), msg).toBe(false);
    }
  });

  it("açık iptal onayını tanır", () => {
    for (const msg of ["evet iptal", "iptal et", "iptali onayliyorum", "evet, iptal edelim"]) {
      expect(isCancelConfirmation(msg), msg).toBe(true);
    }
  });

  it("olumsuz cümleyi onay saymaz", () => {
    expect(isCancelConfirmation("iptal etmek istemiyorum")).toBe(false);
    expect(isCancelConfirmation("iptal etme")).toBe(false);
  });
});

describe("isSoftAffirmation", () => {
  it("kısa onayları tanır", () => {
    for (const msg of ["evet", "tamam", "olur", "peki", "ok"]) {
      expect(isSoftAffirmation(msg), msg).toBe(true);
    }
  });

  it("cümle içindeki kelimeyi onay saymaz", () => {
    expect(isSoftAffirmation("tamam da fiyat ne kadar")).toBe(false);
    expect(isSoftAffirmation("evet ama once fiyat sorayim")).toBe(false);
  });
});

describe("isCancelReject", () => {
  it("vazgeçme ifadelerini tanır", () => {
    for (const msg of ["hayır", "vazgeçtim", "iptal istemiyorum", "gerek yok", "kalsın"]) {
      expect(isCancelReject(msg), msg).toBe(true);
    }
  });
});

describe("isGreetingOrSmallTalkOnly", () => {
  it("sadece selam olan mesajları tanır", () => {
    for (const msg of ["merhaba", "selam", "iyi günler", "nasılsın"]) {
      expect(isGreetingOrSmallTalkOnly(msg), msg).toBe(true);
    }
  });

  it("selam + gerçek talep olan mesajları YAKALAMAZ", () => {
    // Eskiden bunlar sabit karşılamaya düşüyor, talep tamamen kayboluyordu.
    for (const msg of [
      "Merhaba, yarın için yer var mı?",
      "İyi günler, cildim kuru ne önerirsiniz?",
      "Selam, oğlum için de bakabilir misiniz",
    ]) {
      expect(isGreetingOrSmallTalkOnly(msg), msg).toBe(false);
    }
  });
});

describe("isOutOfScopeMessage", () => {
  it("normal randevu mesajlarını kapsam dışı saymaz", () => {
    for (const msg of [
      "Başka gün var mı?",
      "başka bir güne alabilir miyiz",
      "Maske yaptırmak istiyorum",
      "başkası için randevu alabilir miyim",
    ]) {
      expect(isOutOfScopeMessage(msg), msg).toBe(false);
    }
  });
});

describe("isAbusiveMessage", () => {
  it("günlük konuşmayı hakaret saymaz", () => {
    for (const msg of ["lan süper olmuş", "mal aldım", "normal bir gün"]) {
      expect(isAbusiveMessage(msg), msg).toBe(false);
    }
  });

  it("gerçek hakareti yakalar", () => {
    expect(isAbusiveMessage("salak mısın")).toBe(true);
  });
});

describe("isNegotiationMessage", () => {
  it("pazarlık ifadesini tanır", () => {
    expect(isNegotiationMessage("öğrenciyim, indirim var mı")).toBe(true);
  });
});

describe("detectDeterministicIntent", () => {
  it("bilgi sorularında aksiyon tetiklemez", () => {
    for (const msg of [
      "iptal koşullarınız nedir?",
      "gecikme durumunda ne oluyor?",
      "iptal edersem para iadesi var mı?",
    ]) {
      expect(detectDeterministicIntent(msg), msg).toBeNull();
    }
  });

  it("olumsuz cümlelerde iptal tetiklemez", () => {
    for (const msg of ["iptal etmek istemiyorum", "randevumu iptal ettirmemem lazım"]) {
      expect(detectDeterministicIntent(msg), msg).toBeNull();
    }
  });

  it("gerçek iptal talebini yakalar", () => {
    expect(detectDeterministicIntent("randevumu iptal et")).toEqual({ type: "cancel" });
    expect(detectDeterministicIntent("yarın gelemeyeceğim")).toEqual({ type: "cancel" });
  });

  it("gerçek gecikme bildirimini yakalar ve süreyi okur", () => {
    expect(detectDeterministicIntent("20 dk gecikeceğim")).toEqual({
      type: "late",
      minutes: 20,
    });
    expect(detectDeterministicIntent("trafikteyim biraz geç kalacağım")).toEqual({
      type: "late",
      minutes: 15,
    });
  });
});
