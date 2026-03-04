/**
 * QR kod yardımcıları - qrcode paketi ile
 * Hem Node hem browser ortamında çalışır.
 */

import QRCode from "qrcode";

export interface QRToDataURLOptions {
  /** Genişlik (px), varsayılan 256 */
  width?: number;
  /** Kenar boşluğu, varsayılan 2 */
  margin?: number;
  /** Hata düzeltme seviyesi: L, M, Q, H */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

/**
 * Metin/URL için Data URL (base64) QR kodu üretir.
 * <img src={url} /> ile doğrudan kullanılabilir.
 */
export async function qrToDataURL(
  text: string,
  options: QRToDataURLOptions = {}
): Promise<string> {
  const { width = 256, margin = 2, errorCorrectionLevel = "M" } = options;
  return QRCode.toDataURL(text, { width, margin, errorCorrectionLevel });
}

/**
 * QR kod PNG buffer üretir (Node.js / API route için).
 */
export async function qrToBuffer(
  text: string,
  options: { width?: number; margin?: number } = {}
): Promise<Buffer> {
  const { width = 256, margin = 2 } = options;
  return QRCode.toBuffer(text, { width, margin });
}
