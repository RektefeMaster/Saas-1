export type ConversationChannel = "whatsapp";

export type AutomationMode =
  | "AI_ACTIVE"
  | "HUMAN_ACTIVE"
  | "AI_ASSIST"
  | "AUTOMATION_PAUSED";

export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";

export type ConversationPriority = "normal" | "high" | "urgent";

export type MessageDirection = "inbound" | "outbound" | "system";

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export type SenderType = "AI" | "HUMAN" | "SYSTEM";

export type MessageSource =
  | "tenant_inbox"
  | "admin"
  | "automation"
  | "bot"
  | "webhook";

export const DELIVERY_STATUS_RANK: Record<Exclude<DeliveryStatus, "failed">, number> = {
  queued: 10,
  sent: 20,
  delivered: 30,
  read: 40,
};

export interface HandoffSummarySnapshot {
  version: 1;
  generatedAt: string;
  intent?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  collectedFields?: Record<string, unknown>;
  leadScore?: number | null;
  handoffSignals?: Array<{
    type: string;
    severity: string;
    evidence: string[];
  }>;
  recommendedAction?: string | null;
  plainSummary?: string | null;
}

export interface ConversationRow {
  id: string;
  tenant_id: string;
  channel: ConversationChannel;
  external_user_id: string;
  customer_id: string | null;
  assigned_membership_id: string | null;
  automation_mode: AutomationMode;
  conversation_status: ConversationStatus;
  last_message_at: string | null;
  last_inbound_message_at: string | null;
  last_outbound_message_at: string | null;
  last_customer_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: MessageDirection | null;
  last_message_id: string | null;
  service_window_expiry: string | null;
  assigned_at: string | null;
  human_takeover_at: string | null;
  automation_mode_updated_at: string;
  closed_at: string | null;
  unread_count: number;
  priority: ConversationPriority;
  handoff_reason: string | null;
  summary_snapshot: HandoffSummarySnapshot | Record<string, unknown>;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConversationActor {
  kind: "admin" | "tenant";
  userId?: string;
  membershipId?: string;
  canAccessAllTenants?: boolean;
  tenantId?: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: "owner" | "staff" | "manager";
  status: "active" | "invited" | "disabled";
}
