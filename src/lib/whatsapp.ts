const WHATSAPP_API = "https://graph.facebook.com/v18.0";

export interface SendMessageParams {
  to: string;
  text: string;
}

export async function sendWhatsAppMessage({
  to,
  text,
}: SendMessageParams): Promise<boolean> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    console.error("WhatsApp credentials missing");
    return false;
  }

  const normalizedTo = to.replace(/\D/g, "");
  const url = `${WHATSAPP_API}/${phoneId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "text",
    text: { body: text },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("WhatsApp send error:", res.status, err);
    return false;
  }
  return true;
}
