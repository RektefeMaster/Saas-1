import { nanoid } from "nanoid";

export { nanoid };

/** Kısa benzersiz ID (traceId, challengeId, tenant_code vb. için). */
export function shortId(size = 10): string {
  return nanoid(size);
}
