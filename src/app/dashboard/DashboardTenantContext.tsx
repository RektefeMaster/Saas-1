"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";

export interface DashboardFeatureFlags {
  packages?: boolean;
  staff_preference?: boolean;
  crm_extended_profile?: boolean;
  [key: string]: boolean | undefined;
}

export interface StaffOption {
  id: string;
  name: string;
  active: boolean;
}

export interface TenantBasic {
  id: string;
  name: string;
  tenant_code: string;
  contact_phone?: string | null;
  working_hours_text?: string | null;
  config_override?: Record<string, unknown>;
  [key: string]: unknown;
}

interface DashboardTenantContextValue {
  tenantId: string | null;
  tenant: TenantBasic | null;
  setTenant: React.Dispatch<React.SetStateAction<TenantBasic | null>>;
  features: DashboardFeatureFlags | null;
  staffPreferenceEnabled: boolean;
  staffOptions: StaffOption[];
  isLoading: boolean;
}

const DashboardTenantContext = createContext<DashboardTenantContextValue | null>(null);

export function useDashboardTenant() {
  const ctx = useContext(DashboardTenantContext);
  return ctx;
}

export function DashboardTenantProvider({
  tenantId,
  children,
}: {
  tenantId: string | null;
  children: React.ReactNode;
}) {
  const [tenant, setTenant] = useState<TenantBasic | null>(null);

  const { data: tenantData, isLoading: tenantLoading } = useSWR<TenantBasic>(
    tenantId ? `/api/tenant/${tenantId}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: featureData } = useSWR<{ feature_flags?: DashboardFeatureFlags }>(
    tenantId ? `/api/tenant/${tenantId}/features` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const staffPreferenceEnabled = Boolean(featureData?.feature_flags?.staff_preference);

  const { data: staffData } = useSWR<StaffOption[]>(
    tenantId && staffPreferenceEnabled ? `/api/tenant/${tenantId}/staff` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const staffOptions = useMemo(() => {
    if (!Array.isArray(staffData)) return [];
    return staffData.filter((row) => row && row.active);
  }, [staffData]);

  useEffect(() => {
    if (tenantData) setTenant(tenantData);
  }, [tenantData]);

  const features = featureData?.feature_flags ?? null;
  const isLoading = !!tenantId && tenantLoading;

  const value = useMemo<DashboardTenantContextValue>(
    () => ({
      tenantId,
      tenant,
      setTenant,
      features,
      staffPreferenceEnabled,
      staffOptions,
      isLoading,
    }),
    [tenantId, tenant, features, staffPreferenceEnabled, staffOptions, isLoading]
  );

  // Null check ekle - React 19'da Context.Provider'ın children prop'una null geçildiğinde sorun olabilir
  if (children == null) {
    return (
      <DashboardTenantContext.Provider value={value}>
        {null}
      </DashboardTenantContext.Provider>
    );
  }

  // Güvenli render
  try {
    return (
      <DashboardTenantContext.Provider value={value}>
        {children}
      </DashboardTenantContext.Provider>
    );
  } catch (error) {
    console.error("[DashboardTenantProvider] Render hatası:", error);
    return (
      <DashboardTenantContext.Provider value={value}>
        {null}
      </DashboardTenantContext.Provider>
    );
  }
}
