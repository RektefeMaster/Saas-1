import { describe, expect, it } from "vitest";
import { shouldSkipAiProcessing } from "../conversation.service";
import {
  isWizardAllowedBusinessTypeSlug,
  resolveCanonicalSectorCode,
  hasCapability,
  getSectorProfileByKey,
} from "../sectorProfile.service";

describe("shouldSkipAiProcessing", () => {
  it("skips live human modes only (soft-pause uses limited AI resume path)", () => {
    expect(shouldSkipAiProcessing("HUMAN_ACTIVE")).toBe(true);
    expect(shouldSkipAiProcessing("AI_ASSIST")).toBe(true);
    // Soft-pause must NOT skip — otherwise customers are ghosted after handoff.
    expect(shouldSkipAiProcessing("AUTOMATION_PAUSED")).toBe(false);
  });

  it("allows AI_ACTIVE", () => {
    expect(shouldSkipAiProcessing("AI_ACTIVE")).toBe(false);
  });
});

describe("wizard sector filter", () => {
  it("allows beauty/dental slugs", () => {
    expect(isWizardAllowedBusinessTypeSlug("berber")).toBe(true);
    expect(isWizardAllowedBusinessTypeSlug("kadin-kuafor")).toBe(true);
    expect(isWizardAllowedBusinessTypeSlug("dis-klinigi")).toBe(true);
    expect(isWizardAllowedBusinessTypeSlug("guzellik-merkezi")).toBe(true);
  });

  it("hides auto/vet/home from wizard", () => {
    expect(isWizardAllowedBusinessTypeSlug("tamirhane")).toBe(false);
    expect(isWizardAllowedBusinessTypeSlug("veteriner")).toBe(false);
    expect(isWizardAllowedBusinessTypeSlug("hali-yikama")).toBe(false);
  });

  it("maps legacy slugs to canonical codes", () => {
    expect(resolveCanonicalSectorCode("disci")).toBe("dental_clinic");
    expect(resolveCanonicalSectorCode("berber")).toBe("barber");
  });

  it("exposes healthcare capability for dental", () => {
    const dental = getSectorProfileByKey("dental");
    expect(hasCapability(dental, "healthcareCompliance")).toBe(true);
    expect(hasCapability(dental, "booking")).toBe(true);
  });
});
