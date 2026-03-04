const ADMIN_TAKEOVER_REASON_PREFIX = "admin_takeover";

function normalizeActor(actor: string | null | undefined): string {
  const cleaned = (actor || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  const compact = cleaned.replace(/^_+|_+$/g, "");
  return compact || "admin";
}

export function buildAdminTakeoverReason(actor?: string | null): string {
  return `${ADMIN_TAKEOVER_REASON_PREFIX}:${normalizeActor(actor)}`;
}

export function isAdminTakeoverReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return reason.toLowerCase().startsWith(ADMIN_TAKEOVER_REASON_PREFIX);
}
