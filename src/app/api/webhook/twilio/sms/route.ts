import { NextRequest, NextResponse } from "next/server";
import { assertValidTwilioWebhook } from "@/lib/twilio";

const XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
};

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const auth = await assertValidTwilioWebhook(request, form, "/api/webhook/twilio/sms");
  if (!auth.ok) {
    return new NextResponse(auth.error, { status: auth.status });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, { status: 200, headers: XML_HEADERS });
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, { status: 200, headers: XML_HEADERS });
}
