import { NextResponse } from "next/server";

const XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
};

export async function POST() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="tr-TR" voice="alice">Ahi AI numarasına ulaştınız. Lütfen WhatsApp veya SMS üzerinden yazın.</Say></Response>`;
  return new NextResponse(xml, { status: 200, headers: XML_HEADERS });
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="tr-TR" voice="alice">Ahi AI numarasına ulaştınız. Lütfen WhatsApp veya SMS üzerinden yazın.</Say></Response>`;
  return new NextResponse(xml, { status: 200, headers: XML_HEADERS });
}
