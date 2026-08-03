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

/** İşletme tipinden türeyen sektör; panelde alan setlerini belirler. */
export interface TenantSector {
  key: string;
  label: string;
  healthcare: boolean;
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
  sector: TenantSector | null;
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
    fetcher
  );

  const { data: featureData } = useSWR<{
    feature_flags?: DashboardFeatureFlags;
    sector?: TenantSector;
  }>(tenantId ? `/api/tenant/${tenantId}/features` : null, fetcher);

  const staffPreferenceEnabled = Boolean(featureData?.feature_flags?.staff_preference);

  // Features ile paralel çek — flag waterfall'unu kır. Flag kapalıysa listeyi boş tut.
  const { data: staffData } = useSWR<StaffOption[]>(
    tenantId ? `/api/tenant/${tenantId}/staff` : null,
    fetcher
  );

  const staffOptions = useMemo(() => {
    if (!staffPreferenceEnabled || !Array.isArray(staffData)) return [];
    return staffData.filter((row) => row && row.active);
  }, [staffData, staffPreferenceEnabled]);

  useEffect(() => {
    setTenant(null);
  }, [tenantId]);

  useEffect(() => {
    if (tenantData) setTenant(tenantData);
  }, [tenantData]);

  const features = featureData?.feature_flags ?? null;
  const sector = featureData?.sector ?? null;
  const isLoading = !!tenantId && tenantLoading;

  const value = useMemo<DashboardTenantContextValue>(
    () => ({
      tenantId,
      tenant,
      setTenant,
      features,
      sector,
      staffPreferenceEnabled,
      staffOptions,
      isLoading,
    }),
    [tenantId, tenant, features, sector, staffPreferenceEnabled, staffOptions, isLoading]
  );

  return (
    <DashboardTenantContext.Provider value={value}>{children}</DashboardTenantContext.Provider>
  );
}
