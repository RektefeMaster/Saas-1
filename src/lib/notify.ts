import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendInfoSms, isInfoSmsEnabled } from "@/lib/sms";

function smsMode(): "fallback" | "always" {
  const value = (process.env.INFO_SMS_MODE || "fallback").trim().toLowerCase();
  return value === "always" ? "always" : "fallback";
}

export interface NotifyResult {
  whatsapp: boolean;
  sms: boolean;
}

export async function sendCustomerNotification(
  to: string,
  text: string
): Promise<NotifyResult> {
  const waOk = await sendWhatsAppMessage({ to, text });
  if (!isInfoSmsEnabled()) {
    return { whatsapp: waOk, sms: false };
  }

  if (smsMode() === "always") {
    const smsOk = await sendInfoSms(to, text);
    return { whatsapp: waOk, sms: smsOk };
  }

  if (!waOk) {
    const smsOk = await sendInfoSms(to, text);
    return { whatsapp: waOk, sms: smsOk };
  }

  return { whatsapp: waOk, sms: false };
}
