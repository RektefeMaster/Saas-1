/**
 * Bot FSM — Geçersiz durum geçişlerini engeller.
 * COMPLETED → COLLECTING_FIELDS gibi mantıksız geçişler fiziksel olarak bloke edilir.
 */

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
  // Müşteri akış ortasında fikir değiştirebilir; sohbet adımları birbirine
  // serbestçe geçebilmeli. Eskiden bu geçişler sessizce bloke ediliyordu.
  tarih_saat_bekleniyor: [
    "saat_secimi_bekleniyor",
    "iptal_onay_bekleniyor",
    "EXECUTING",
    "COMPLETED",
    "PAUSED_FOR_HUMAN",
    "devam",
  ],
  saat_secimi_bekleniyor: [
    "tarih_saat_bekleniyor",
    "iptal_onay_bekleniyor",
    "EXECUTING",
    "COMPLETED",
    "PAUSED_FOR_HUMAN",
    "devam",
  ],
  iptal_onay_bekleniyor: [
    "tarih_saat_bekleniyor",
    "saat_secimi_bekleniyor",
    "EXECUTING",
    "COMPLETED",
    "PAUSED_FOR_HUMAN",
    "devam",
  ],
  EXECUTING: ["devam", "COMPLETED"],
  COMPLETED: ["devam", "INIT"],
  PAUSED_FOR_HUMAN: ["RECOVERY_CHECK", "devam"],
  RECOVERY_CHECK: ["devam"],
  INTENT_ROUTING: ["COLLECTING_FIELDS", "devam"],
  COLLECTING_FIELDS: ["AWAITING_CONFIRMATION", "devam"],
  AWAITING_CONFIRMATION: ["EXECUTING", "COLLECTING_FIELDS"],
  FAILED_SAFE: ["INIT", "devam"],
};

/**
 * Geçerli geçiş mi kontrol eder.
 */
export function canTransition(currentStep: string, nextStep: string): boolean {
  // Aynı adımda kalmak her zaman geçerli (ör. müşteri ikinci bir gün soruyor).
  if (currentStep === nextStep) return true;
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
