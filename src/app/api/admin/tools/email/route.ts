import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isValidEmail } from "@/lib/validation";

/**
 * Lazy init: modül seviyesinde `new Resend(undefined)` çağrısı, RESEND_API_KEY
 * tanımlı olmayan ortamlarda "Missing API key" fırlatıp `next build` sırasında
 * page-data toplamayı komple çökertiyordu.
 */
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY tanımlı değil");
  return new Resend(key);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const to = String(body.to ?? "").trim();
    if (!to) {
      return NextResponse.json({ error: "to (e-posta) gerekli" }, { status: 400 });
    }
    if (!isValidEmail(to)) {
      return NextResponse.json({ error: "Geçersiz e-posta adresi" }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY tanımlı değil" },
        { status: 503 }
      );
    }

    const { error } = await getResend().emails.send({
      from: "Ahi AI Test <onboarding@resend.dev>",
      to: [to],
      subject: "[Ahi AI] Test E-postası",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #0f172a;">Test E-postası</h2>
          <p style="color: #475569;">Bu e-posta Admin Araçlarından gönderildi.</p>
          <p style="color: #64748b; font-size: 14px;">Resend entegrasyonu çalışıyor ✓</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "E-posta gönderilemedi" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin tools email]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "E-posta hatası" },
      { status: 500 }
    );
  }
}
