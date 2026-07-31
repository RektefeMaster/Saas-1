import { NextRequest, NextResponse } from "next/server";
import { assertValidTwilioWebhook } from "@/lib/twilio";

const XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
};

const SAY_XML = `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="tr-TR" voice="alice">Ahi AI numarasına ulaştınız. Lütfen WhatsApp veya SMS üzerinden yazın.</Say></Response>`;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const auth = await assertValidTwilioWebhook(request, form, "/api/webhook/twilio/voice");
  if (!auth.ok) {
    return new NextResponse(auth.error, { status: auth.status });
  }
  return new NextResponse(SAY_XML, { status: 200, headers: XML_HEADERS });
}

export async function GET() {
  return new NextResponse(SAY_XML, { status: 200, headers: XML_HEADERS });
}
