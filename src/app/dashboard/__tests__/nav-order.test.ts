import { describe, expect, it } from "vitest";
import { applyModuleOrder } from "../nav-order";

const NAV = [
  "overview",
  "inbox",
  "pricing",
  "workflow",
  "crm",
  "knowledge",
  "campaigns",
  "settings",
].map((key) => ({ key }));

const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe("applyModuleOrder", () => {
  it("keeps natural order when no preference is stored", () => {
    expect(keys(applyModuleOrder(NAV, null))).toEqual(keys(NAV));
    expect(keys(applyModuleOrder(NAV, []))).toEqual(keys(NAV));
  });

  it("ignores a stale partial order instead of dumping the rest at the end", () => {
    // Kurulum sihirbazının eski sabiti: yeni modülleri kapsamıyor.
    const stale = ["overview", "calendar", "pricing", "workflow", "crm", "settings"];
    const ordered = keys(applyModuleOrder(NAV, stale));

    expect(ordered).toEqual(keys(NAV));
    // Regresyonun asıl belirtisi: Ayarlar ortaya, Gelen Kutusu altına düşüyordu.
    expect(ordered.indexOf("inbox")).toBeLessThan(ordered.indexOf("settings"));
    expect(ordered[ordered.length - 1]).toBe("settings");
  });

  it("applies a complete order", () => {
    const complete = [
      "settings",
      "campaigns",
      "knowledge",
      "crm",
      "workflow",
      "pricing",
      "inbox",
      "overview",
    ];
    expect(keys(applyModuleOrder(NAV, complete))).toEqual(complete);
  });

  it("still applies when a hidden module is missing from the visible list", () => {
    const visible = NAV.filter((i) => i.key !== "campaigns");
    const complete = [
      "overview",
      "inbox",
      "pricing",
      "workflow",
      "crm",
      "knowledge",
      "campaigns",
      "settings",
    ];
    expect(keys(applyModuleOrder(visible, complete))).toEqual(keys(visible));
  });
});
