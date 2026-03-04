import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { isValidEmail } from "@/lib/validation";

const resend = new Resend(process.env.RESEND_API_KEY);

function getContactEmail(): string {
  return (
    process.env.CONTACT_EMAIL ||
    process.env.ADMIN_HIDDEN_LOGIN_IDENTIFIER ||
    "nuronuro458@gmail.com"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Ad, e-posta ve mesaj zorunludur." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi girin." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.error("RESEND_API_KEY tanımlı değil");
      return NextResponse.json(
        { error: "E-posta servisi yapılandırılmamış." },
        { status: 503 }
      );
    }

    const toEmail = getContactEmail();
    const subject = `[Ahi AI İletişim] ${name}`;
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #0f172a;">Yeni İletişim Formu Mesajı</h2>
        <p style="color: #475569;"><strong>Gönderen:</strong> ${name}</p>
        <p style="color: #475569;"><strong>E-posta:</strong> ${email}</p>
        ${phone ? `<p style="color: #475569;"><strong>Telefon:</strong> ${phone}</p>` : ""}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1rem 0;" />
        <p style="color: #334155; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Ahi AI İletişim <onboarding@resend.dev>",
      to: [toEmail],
      replyTo: email,
      subject,
      html,
    });

    if (error) {
      logger.error({ err: error }, "Resend error");
      return NextResponse.json(
        { error: "Mesaj gönderilemedi. Lütfen daha sonra tekrar deneyin." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Contact API error");
    return NextResponse.json(
      { error: "Bir hata oluştu. Lütfen daha sonra tekrar deneyin." },
      { status: 500 }
    );
  }
}
