/**
 * Tenant paylaşım varlıkları üretimi: WhatsApp link, QR kod, sosyal medya metinleri
 * @module generateTenantAssets
 */

import QRCode from "qrcode";
import type { Tenant, SharePackage } from "@/types/tenant.types";

/** API telefon numarası (wa.me için); env: WHATSAPP_API_PHONE veya WHATSAPP_PHONE_NUMBER */
function getApiPhone(): string {
  const phone =
    process.env.WHATSAPP_API_PHONE || process.env.WHATSAPP_PHONE_NUMBER || "905551234567";
  return phone.replace(/\D/g, "");
}

/**
 * Tenant için WhatsApp link üretir.
 * Format: https://wa.me/{API_PHONE}?text=Merhaba%20{tenant_name}%20için%20randevu%20almak%20istiyorum.%20Kod%3A%20{tenant_code}
 *
 * @param tenant - Esnaf bilgileri (id, name, tenant_code)
 * @returns WhatsApp wa.me linki
 *
 * @example
 * const link = generateWhatsAppLink({ id: "1", name: "Kuaför Ahmet", tenant_code: "AHMET01" });
 * // "https://wa.me/905551234567?text=Merhaba%20Kuaf%C3%B6r%20Ahmet%20i%C3%A7in%20..."
 */
export function generateWhatsAppLink(tenant: Tenant): string {
  const apiPhone = getApiPhone();
  const message = `Merhaba ${tenant.name} için randevu almak istiyorum. Kod: ${tenant.tenant_code}`;
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${apiPhone}?text=${encodedText}`;
}

/**
 * WhatsApp linkinin QR kodunu PNG buffer olarak üretir.
 *
 * @param tenant - Esnaf bilgileri
 * @returns PNG buffer (Node.js Buffer)
 *
 * @example
 * const buffer = await generateQRCode(tenant);
 * fs.writeFileSync("qr.png", buffer);
 */
export async function generateQRCode(tenant: Tenant): Promise<Buffer> {
  const link = generateWhatsAppLink(tenant);
  return QRCode.toBuffer(link, { width: 256, margin: 2 });
}

/**
 * Esnaf paylaşım paketi: link, QR (base64), Instagram bio, Google Maps açıklama
 *
 * @param tenant - Esnaf bilgileri
 * @returns SharePackage
 *
 * @example
 * const pkg = await generateSharePackage(tenant);
 * console.log(pkg.whatsapp_link);
 * console.log(pkg.instagram_bio);
 */
export async function generateSharePackage(tenant: Tenant): Promise<SharePackage> {
  const whatsappLink = generateWhatsAppLink(tenant);
  const qrBuffer = await generateQRCode(tenant);
  const qrBase64 = qrBuffer.toString("base64");

  const instagramBio = [
    `Randevu almak için WhatsApp ile yazın`,
    ``,
    `Link: ${whatsappLink}`,
    ``,
    `#randevu #${tenant.tenant_code}`,
  ].join("\n");

  const googleMapsDescription = [
    `${tenant.name} ile randevu almak için WhatsApp üzerinden iletişime geçin.`,
    `Link: ${whatsappLink}`,
    `Kod: ${tenant.tenant_code}`,
  ].join(" ");

  return {
    whatsapp_link: whatsappLink,
    qr_base64_png: qrBase64,
    instagram_bio: instagramBio,
    google_maps_description: googleMapsDescription,
  };
}

/*
 * Örnek kullanım:
 *
 * const tenant = { id: "uuid", name: "Kuaför Ahmet", tenant_code: "AHMET01" };
 *
 * const link = generateWhatsAppLink(tenant);
 * const qrBuffer = await generateQRCode(tenant);
 * const pkg = await generateSharePackage(tenant);
 *
 * // API response:
 * return NextResponse.json({
 *   ...pkg,
 *   tenant_name: tenant.name,
 *   tenant_code: tenant.tenant_code,
 * });
 */
