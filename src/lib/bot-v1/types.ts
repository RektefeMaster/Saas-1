export type IncomingMessage = {
  id?: string;
  type?: string;
  from?: string;
  timestamp?: string;
  text?: { body?: string };
  audio?: { id?: string };
  image?: { id?: string; mime_type?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string };
  };
};

export type IncomingContact = {
  wa_id?: string;
};

export type IncomingWebhookValue = {
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: IncomingContact[];
  messages?: IncomingMessage[];
  statuses?: unknown[];
};

export interface WhatsAppInboundEventData {
  trace_id: string;
  provider: "whatsapp";
  message_id: string;
  tenant_hint: string | null;
  phone: string;
  received_at: string;
  message_type: string;
  raw_ref: string;
  value: IncomingWebhookValue;
  message: IncomingMessage;
}
