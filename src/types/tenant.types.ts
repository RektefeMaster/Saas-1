/**
 * Tenant ve paylaşım paketi tip tanımları
 */

/** Esnaf (kiracı) temel bilgileri */
export interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
}

/** Esnaf paylaşım paketi – link, QR, sosyal medya metinleri */
export interface SharePackage {
  whatsapp_link: string;
  qr_base64_png: string;
  instagram_bio: string;
  google_maps_description: string;
}

/** Meta WhatsApp Webhook gelen mesaj payload */
export interface WebhookPayload {
  object?: string;
  entry?: WebhookEntry[];
}

export interface WebhookEntry {
  id?: string;
  changes?: WebhookChange[];
}

export interface WebhookChange {
  field?: string;
  value?: {
    messaging_product?: string;
    metadata?: { display_phone_number?: string; phone_number_id?: string };
    contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
    messages?: WebhookMessage[];
  };
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}
