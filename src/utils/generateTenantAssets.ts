/**
 * Tenant paylaşım varlıkları üretimi: WhatsApp link, QR kod, sosyal medya metinleri
 * @module generateTenantAssets
 */

import QRCode from "qrcode";
import type { Tenant, SharePackage } from "@/types/tenant.types";
import { encodeTenantMarker } from "@/lib/zero-width";

/** API telefon numarası (wa.me için); env: WHATSAPP_API_PHONE veya WHATSAPP_PHONE_NUMBER */
function getApiPhone(): string {
  const phone =
    process.env.WHATSAPP_API_PHONE || process.env.WHATSAPP_PHONE_NUMBER || "905551234567";
  return phone.replace(/\D/g, "");
}

function normalizeForCompare(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Tenant için WhatsApp link üretir.
 * İşletmeye özel `config_override.messages.whatsapp_greeting` varsa onu kullanır,
 * yoksa varsayılan doğal karşılama mesajı üretir.
 * Tenant kodu mesajın sonuna görünmez marker (zero-width) olarak eklenir.
 *
 * @param tenant - Esnaf bilgileri (id, name, tenant_code, config_override?)
 * @returns WhatsApp wa.me linki
 */
export function generateWhatsAppLink(tenant: Tenant): string {
  const apiPhone = getApiPhone();
  const customGreeting = tenant.config_override?.messages?.whatsapp_greeting;
  const rawGreeting = customGreeting
    ? customGreeting.replace(/\{tenant_name\}/g, tenant.name)
    : `Merhaba ${tenant.name}, randevu almak istiyorum`;
  const hasTenantName =
    normalizeForCompare(rawGreeting).includes(normalizeForCompare(tenant.name));
  const greeting = hasTenantName
    ? rawGreeting.trim()
    : `Merhaba ${tenant.name}, ${rawGreeting.trim()}`;
  const hiddenMarker = encodeTenantMarker(tenant.tenant_code);
  const message = `${greeting}${hiddenMarker}`;
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
  ].join("\n");

  const googleMapsDescription = [
    `${tenant.name} ile randevu almak için WhatsApp üzerinden iletişime geçin.`,
    `Link: ${whatsappLink}`,
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
 * const link = generateWhatsAppLink(tenant);
 * // -> "https://wa.me/905551234567?text=Merhaba%2C%20Kuaf%C3%B6r%20Ahmet%20i%C3%A7in%20randevu%20almak%20istiyorum..."
 *
 * // Özel greeting ile:
 * const t2 = { ...tenant, config_override: { messages: { whatsapp_greeting: "Selam, saç kesimi istiyorum" } } };
 * const link2 = generateWhatsAppLink(t2);
 * // -> "...?text=Selam%2C%20sa%C3%A7%20kesimi%20istiyorum..."
 */
