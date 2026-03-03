import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processWhatsAppMessageFn } from "@/lib/inngest/functions/process-whatsapp-message";

export const runtime = "nodejs";
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processWhatsAppMessageFn],
});
