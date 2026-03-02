import { NextRequest, NextResponse } from "next/server";

const XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
};

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const from = String(form?.get("From") || "");
  const body = String(form?.get("Body") || "");
  const to = String(form?.get("To") || "");

  console.log("[twilio sms webhook]", {
    from,
    to,
    body: body.slice(0, 300),
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, { status: 200, headers: XML_HEADERS });
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, { status: 200, headers: XML_HEADERS });
}
