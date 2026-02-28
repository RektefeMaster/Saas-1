/**
 * Tenant izolasyonu: uygulama katmanında tenant_id tutarlılığı.
 * RLS'e ek olarak, path/context'teki tenant_id ile işlem yapılan tenant_id
 * aynı olmalı; farklıysa 403 dönülmeli.
 */

export class TenantScopeError extends Error {
  constructor(
    message: string,
    public readonly status: number = 403
  ) {
    super(message);
    this.name = "TenantScopeError";
  }
}

/**
 * İstekte gelen tenant_id ile işlem yapılan tenant_id aynı mı kontrol eder.
 * Farklıysa TenantScopeError fırlatır (403).
 * API route'larda path'ten gelen id ile session/body'deki tenant_id karşılaştırmak için kullanın.
 */
export function requireTenantMatch(
  operationTenantId: string,
  requestTenantId: string | undefined | null
): void {
  if (!requestTenantId || operationTenantId !== requestTenantId) {
    throw new TenantScopeError("Bu işlem için yetkiniz yok.", 403);
  }
}

/**
 * tenant_id'nin dolu ve geçerli UUID olduğunu doğrular.
 * Boş veya geçersizse TenantScopeError fırlatır.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireValidTenantId(tenantId: string | undefined | null): asserts tenantId is string {
  if (!tenantId || typeof tenantId !== "string" || !UUID_REGEX.test(tenantId)) {
    throw new TenantScopeError("Geçersiz tenant.", 400);
  }
}
