import { describe, it, expect } from "vitest";
import {
  buildSectorRulesPrompt,
  detectSectorKey,
  getSectorProfile,
  getSectorProfileByKey,
  listSectorProfiles,
} from "../sectorProfile.service";

describe("detectSectorKey", () => {
  it("kuaför / berber / güzellik salonunu hair-beauty olarak tanır", () => {
    expect(detectSectorKey("kadin-kuafor", "Kadin Kuafor / Guzellik Salonu")).toBe(
      "hair-beauty"
    );
    expect(detectSectorKey("berber", "Berber")).toBe("hair-beauty");
    expect(detectSectorKey(null, "Güzellik Salonu")).toBe("hair-beauty");
  });

  it("tırnak salonunu nail olarak tanır (salon kelimesine takılmaz)", () => {
    expect(detectSectorKey("tirnak-salonu", "Tirnak Salonu")).toBe("nail");
    expect(detectSectorKey(null, "Nail Studio")).toBe("nail");
  });

  it("lazer epilasyon ve medikal estetiği laser-aesthetic olarak tanır", () => {
    expect(detectSectorKey("lazer-epilasyon", "Lazer Epilasyon Merkezi")).toBe(
      "laser-aesthetic"
    );
    expect(detectSectorKey(null, "Medikal Estetik Merkezi")).toBe("laser-aesthetic");
    expect(detectSectorKey(null, "Dermatoloji Kliniği")).toBe("laser-aesthetic");
    // "cilt bakımı" tek başına güzellik/kuaför; medikal estetik false-positive olmamalı
    expect(detectSectorKey(null, "Cilt Bakım Merkezi")).toBe("hair-beauty");
  });

  it("diş kliniği ve gülüş estetiğini dental olarak tanır", () => {
    expect(detectSectorKey("dis-klinigi", "Diş Kliniği / Gülüş Estetiği")).toBe("dental");
    expect(detectSectorKey("disci", "Dişçi")).toBe("dental");
    expect(detectSectorKey(null, "Gülüş Tasarımı Kliniği")).toBe("dental");
    expect(detectSectorKey(null, "Ortodonti Merkezi")).toBe("dental");
  });

  it("gülüş estetiği hem 'estetik' hem 'diş' içerse de dental kalır", () => {
    expect(detectSectorKey(null, "Diş ve Estetik Kliniği")).toBe("dental");
  });

  it("bilinmeyen işletme tipinde generic döner", () => {
    expect(detectSectorKey(null, null)).toBe("generic");
    expect(detectSectorKey("", "Kitapçı")).toBe("generic");
  });
});

describe("sektör profili davranışı", () => {
  it("sağlık sektörlerinde esnaf ağzı kapalıdır", () => {
    for (const key of ["dental", "laser-aesthetic", "veterinary"] as const) {
      const profile = getSectorProfileByKey(key);
      expect(profile.healthcare).toBe(true);
      expect(profile.allowCasualSlang).toBe(false);
    }
  });

  it("kuaför/tırnak tarafında samimi ton serbesttir", () => {
    expect(getSectorProfileByKey("hair-beauty").allowCasualSlang).toBe(true);
    expect(getSectorProfileByKey("nail").allowCasualSlang).toBe(true);
  });

  it("sağlık sektörlerinde teşhis ve garanti yasağı prompt'a giriyor", () => {
    const dentalRules = buildSectorRulesPrompt(getSectorProfileByKey("dental"));
    expect(dentalRules).toContain("Teşhis koyma");
    expect(dentalRules).toContain("garanti");

    const laserRules = buildSectorRulesPrompt(getSectorProfileByKey("laser-aesthetic"));
    expect(laserRules).toContain("Teşhis koyma");
    expect(laserRules).toContain("tıraş");
  });

  it("diş kliniğinde acil ağrı yönlendirmesi tanımlı", () => {
    const rules = buildSectorRulesPrompt(getSectorProfileByKey("dental"));
    expect(rules).toContain("ACİL DURUM");
    expect(rules.toLowerCase()).toContain("ağrı kesici");
  });

  it("kural tanımlı olmayan sektörde boş prompt döner (prompt şişmesin)", () => {
    expect(buildSectorRulesPrompt(getSectorProfileByKey("generic"))).toBe("");
  });

  it("her sektör geçerli bir blueprint'e eşlenir", () => {
    const valid = new Set([
      "hair-beauty",
      "dental-esthetic",
      "auto-service",
      "generic-local",
    ]);
    for (const profile of listSectorProfiles()) {
      expect(valid.has(profile.blueprint)).toBe(true);
    }
  });

  it("güzellik ve lazer sektörlerinde paket/uzman bayrakları varsayılan açık", () => {
    for (const key of ["hair-beauty", "nail", "laser-aesthetic", "dental"] as const) {
      const flags = getSectorProfileByKey(key).defaultFeatureFlags;
      expect(flags.packages).toBe(true);
      expect(flags.staff_preference).toBe(true);
      expect(flags.crm_extended_profile).toBe(true);
    }
  });

  it("getSectorProfile slug/isim ile profili döndürür", () => {
    expect(getSectorProfile("lazer-epilasyon", null).key).toBe("laser-aesthetic");
    expect(getSectorProfile(null, "Oto Servis").key).toBe("auto-service");
  });
});
