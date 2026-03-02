import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export interface TenantEventLogInput {
  tenantId: string;
  eventType: string;
  actor?: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export async function logTenantEvent(input: TenantEventLogInput): Promise<void> {
  const { error } = await supabase.from("tenant_event_logs").insert({
    tenant_id: input.tenantId,
    event_type: input.eventType,
    actor: input.actor || "system",
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    payload: input.payload || {},
  });

  if (!error) return;

  const missingTable = extractMissingSchemaTable(error);
  if (missingTable === "tenant_event_logs") return;

  console.error("[event-log] insert error", error.message);
}
