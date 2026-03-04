/**
 * xstate: Bot FSM — Geçersiz durum geçişlerini engeller.
 * COMPLETED → COLLECTING_FIELDS gibi mantıksız geçişler fiziksel olarak bloke edilir.
 */
import { createMachine } from "xstate";

// Geçerli geçişler: from -> [to]
const VALID_TRANSITIONS: Record<string, string[]> = {
  INIT: ["tenant_bulundu", "devam", "PAUSED_FOR_HUMAN"],
  tenant_bulundu: ["devam"],
  devam: [
    "tarih_saat_bekleniyor",
    "saat_secimi_bekleniyor",
    "iptal_onay_bekleniyor",
    "EXECUTING",
    "PAUSED_FOR_HUMAN",
    "COMPLETED",
  ],
  tarih_saat_bekleniyor: ["saat_secimi_bekleniyor", "devam"],
  saat_secimi_bekleniyor: ["EXECUTING", "devam"],
  iptal_onay_bekleniyor: ["EXECUTING", "devam"],
  EXECUTING: ["devam", "COMPLETED"],
  COMPLETED: ["devam", "INIT"],
  PAUSED_FOR_HUMAN: ["RECOVERY_CHECK", "devam"],
  RECOVERY_CHECK: ["devam"],
  INTENT_ROUTING: ["COLLECTING_FIELDS", "devam"],
  COLLECTING_FIELDS: ["AWAITING_CONFIRMATION", "devam"],
  AWAITING_CONFIRMATION: ["EXECUTING", "COLLECTING_FIELDS"],
  FAILED_SAFE: ["INIT", "devam"],
};

/** xstate machine — Stately Inspector veya görsel şema için */
export const botConversationMachine = createMachine({
  id: "bot-conversation",
  initial: "INIT",
  states: {
    INIT: { on: { tenant_found: "tenant_bulundu", continue: "devam", pause: "PAUSED_FOR_HUMAN" } },
    tenant_bulundu: { on: { continue: "devam" } },
    devam: {
      on: {
        await_date: "tarih_saat_bekleniyor",
        await_time: "saat_secimi_bekleniyor",
        await_cancel: "iptal_onay_bekleniyor",
        execute: "EXECUTING",
        pause: "PAUSED_FOR_HUMAN",
        complete: "COMPLETED",
      },
    },
    tarih_saat_bekleniyor: { on: { await_time: "saat_secimi_bekleniyor", continue: "devam" } },
    saat_secimi_bekleniyor: { on: { execute: "EXECUTING", continue: "devam" } },
    iptal_onay_bekleniyor: { on: { execute: "EXECUTING", continue: "devam" } },
    EXECUTING: { on: { continue: "devam", complete: "COMPLETED" } },
    COMPLETED: { on: { continue: "devam", reset: "INIT" } },
    PAUSED_FOR_HUMAN: { on: { recover: "RECOVERY_CHECK", continue: "devam" } },
    RECOVERY_CHECK: { on: { continue: "devam" } },
    INTENT_ROUTING: { on: { collect: "COLLECTING_FIELDS", continue: "devam" } },
    COLLECTING_FIELDS: { on: { await_confirm: "AWAITING_CONFIRMATION", continue: "devam" } },
    AWAITING_CONFIRMATION: { on: { execute: "EXECUTING", collect: "COLLECTING_FIELDS" } },
    FAILED_SAFE: { on: { reset: "INIT", continue: "devam" } },
  },
});

/**
 * Geçerli geçiş mi kontrol eder.
 */
export function canTransition(currentStep: string, nextStep: string): boolean {
  const allowed = VALID_TRANSITIONS[currentStep];
  if (!allowed) return true; // Bilinmeyen state → izin ver (eski davranış)
  return allowed.includes(nextStep);
}

/**
 * Geçerli yeni step döndürür. Geçiş geçersizse mevcut step korunur.
 */
export function getValidNextStep(
  currentStep: string,
  desiredNextStep: string
): string {
  if (canTransition(currentStep, desiredNextStep)) {
    return desiredNextStep;
  }
  console.warn(
    `[fsm] Geçersiz geçiş engellendi: ${currentStep} → ${desiredNextStep}`
  );
  return currentStep;
}
