"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, PauseCircle, PlayCircle, RefreshCw, Send } from "lucide-react";
import { toast } from "@/lib/toast";

type RiskConversationItem = {
  tenant_id: string;
  tenant_name: string | null;
  tenant_code: string | null;
  customer_phone_digits: string;
  last_message_at: string;
  last_inbound_text: string | null;
  last_outbound_text: string | null;
  inbound_count: number;
  outbound_count: number;
  system_count: number;
  message_count: number;
  stage_counts: Record<string, number>;
  risk_reasons: string[];
  risk_score: number;
  risk_threshold: number;
  effective_threshold: number;
  threshold_source: "default" | "tenant";
  tenant_risk_config: {
    min_score: number;
    high_stage_weight: number;
    high_stage_cap: number;
    medium_stage_weight: number;
    medium_stage_cap: number;
    paused_weight: number;
    admin_takeover_weight: number;
    inbound_without_outbound_weight: number;
    long_conversation_weight: number;
  } | null;
  paused_for_human: boolean;
  admin_takeover_active: boolean;
  pause_reason: string | null;
  current_step: string | null;
  recommended_action: "takeover" | "send_or_resume";
};

type RiskyApiResponse = {
  query: {
    hours: number;
    min_score_filter: number;
    limit: number;
    tenant_id: string | null;
    phone_digits: string | null;
    from: string;
    to: string;
  };
  total: number;
  items: RiskConversationItem[];
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreClass(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
  if (score >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

export default function AdminConversationsPage() {
  const [items, setItems] = useState<RiskConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(48);
  const [minScore, setMinScore] = useState(20);
  const [limit, setLimit] = useState(60);
  const [tenantId, setTenantId] = useState("");
  const [phone, setPhone] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredTenantId = tenantId.trim();
  const filteredPhone = phone.trim();

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        hours: String(hours),
        min_score: String(minScore),
        limit: String(limit),
      });
      if (filteredTenantId) params.set("tenant_id", filteredTenantId);
      if (filteredPhone) params.set("phone", filteredPhone);

      const response = await fetch(`/api/admin/conversations/risky?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | RiskyApiResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error || "Liste alinamadi" : "Liste alinamadi");
      }

      const data = payload as RiskyApiResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [filteredPhone, filteredTenantId, hours, limit, minScore]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setThresholdDrafts((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (next[item.tenant_id] == null) {
          next[item.tenant_id] = item.risk_threshold;
        }
      }
      return next;
    });
  }, [items]);

  const runAction = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      setActionLoading(id);
      try {
        await fn();
        await fetchList();
      } catch (err) {
        toast.error("Islem basarisiz", err instanceof Error ? err.message : String(err));
      } finally {
        setActionLoading(null);
      }
    },
    [fetchList]
  );

  const totals = useMemo(
    () => ({
      activeTakeover: items.filter((item) => item.admin_takeover_active).length,
      highRisk: items.filter((item) => item.risk_score >= 80).length,
    }),
    [items]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Riskli Konusmalar</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Takeover, manuel mesaj ve resume islemlerini tek ekrandan yonetin
          </p>
        </div>
        <button
          type="button"
          onClick={fetchList}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Yenile
        </button>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">Saat Araligi</span>
            <input
              type="number"
              min={1}
              max={336}
              value={hours}
              onChange={(event) => setHours(Math.min(336, Math.max(1, Number(event.target.value) || 1)))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">Min Score</span>
            <input
              type="number"
              min={0}
              max={500}
              value={minScore}
              onChange={(event) => setMinScore(Math.min(500, Math.max(0, Number(event.target.value) || 0)))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">Limit</span>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(event) => setLimit(Math.min(200, Math.max(1, Number(event.target.value) || 1)))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">Tenant ID</span>
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="opsiyonel"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">Telefon</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="90555..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-slate-500 dark:text-slate-400">Toplam Riskli Sohbet</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{items.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-slate-500 dark:text-slate-400">Aktif Takeover</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.activeTakeover}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-slate-500 dark:text-slate-400">Yuksek Risk</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{totals.highRisk}</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Filtreye uygun riskli sohbet bulunamadi.
          </div>
        ) : (
          items.map((item) => {
            const key = `${item.tenant_id}:${item.customer_phone_digits}`;
            const draft = drafts[key] || "";
            const canSend = item.admin_takeover_active && draft.trim().length > 0;

            return (
              <article key={key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.tenant_name || "Bilinmeyen tenant"}{" "}
                      {item.tenant_code ? (
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          ({item.tenant_code})
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Tel: {item.customer_phone_digits} • Son: {formatDate(item.last_message_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${scoreClass(item.risk_score)}`}>
                      Risk {item.risk_score}
                    </span>
                    {item.admin_takeover_active ? (
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        Takeover Aktif
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                    <p className="font-medium text-slate-700 dark:text-slate-200">Son Musteri Mesaji</p>
                    <p className="mt-1 break-words text-slate-600 dark:text-slate-300">
                      {item.last_inbound_text || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                    <p className="font-medium text-slate-700 dark:text-slate-200">Son Cikis Mesaji</p>
                    <p className="mt-1 break-words text-slate-600 dark:text-slate-300">
                      {item.last_outbound_text || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                    <p className="font-medium text-slate-700 dark:text-slate-200">Sayaclar</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      In: {item.inbound_count} • Out: {item.outbound_count} • Sys: {item.system_count}
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      Toplam: {item.message_count} • Step: {item.current_step || "—"}
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      Neden: {item.risk_reasons.join(", ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.admin_takeover_active ? (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(`resume:${key}`, async () => {
                          const res = await fetch("/api/admin/conversations/resume", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              tenant_id: item.tenant_id,
                              customer_phone: item.customer_phone_digits,
                              actor: "admin_ui",
                            }),
                          });
                          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                          if (!res.ok) throw new Error(payload?.error || "Resume basarisiz");
                          toast.success("Takeover sonlandirildi");
                        })
                      }
                      disabled={Boolean(actionLoading)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                    >
                      {actionLoading === `resume:${key}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(`takeover:${key}`, async () => {
                          const res = await fetch("/api/admin/conversations/takeover", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              tenant_id: item.tenant_id,
                              customer_phone: item.customer_phone_digits,
                              actor: "admin_ui",
                            }),
                          });
                          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                          if (!res.ok) throw new Error(payload?.error || "Takeover basarisiz");
                          toast.success("Takeover aktif edildi");
                        })
                      }
                      disabled={Boolean(actionLoading)}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
                    >
                      {actionLoading === `takeover:${key}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                      Takeover
                    </button>
                  )}

                  {item.admin_takeover_active ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Bot cevaplari worker tarafinda bypass ediliyor
                    </span>
                  ) : null}

                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Esik: {item.risk_threshold} ({item.threshold_source === "tenant" ? "tenant" : "default"}) · Uygulanan: {item.effective_threshold}
                  </span>
                </div>

                {item.admin_takeover_active ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={draft}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder="Musteriye manuel mesaj yazin..."
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={!canSend || Boolean(actionLoading)}
                      onClick={() =>
                        runAction(`send:${key}`, async () => {
                          const res = await fetch("/api/admin/conversations/send", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              tenant_id: item.tenant_id,
                              customer_phone: item.customer_phone_digits,
                              text: draft.trim(),
                              actor: "admin_ui",
                            }),
                          });
                          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                          if (!res.ok) throw new Error(payload?.error || "Mesaj gonderilemedi");
                          setDrafts((prev) => ({ ...prev, [key]: "" }));
                          toast.success("Manuel mesaj gonderildi");
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {actionLoading === `send:${key}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Gonder
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-xs text-slate-600 dark:text-slate-300">
                    Tenant Risk Esigi
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={thresholdDrafts[item.tenant_id] ?? item.risk_threshold}
                    onChange={(event) =>
                      setThresholdDrafts((prev) => ({
                        ...prev,
                        [item.tenant_id]: Math.min(500, Math.max(0, Number(event.target.value) || 0)),
                      }))
                    }
                    className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() =>
                      runAction(`threshold:${item.tenant_id}`, async () => {
                        const nextThreshold = thresholdDrafts[item.tenant_id] ?? item.risk_threshold;

                        const readRes = await fetch(`/api/admin/tenants/${item.tenant_id}`, {
                          cache: "no-store",
                        });
                        const readPayload = (await readRes.json().catch(() => null)) as
                          | { error?: string; config_override?: unknown }
                          | null;
                        if (!readRes.ok) {
                          throw new Error(
                            readPayload && "error" in readPayload
                              ? readPayload.error || "Tenant ayarlari okunamadi"
                              : "Tenant ayarlari okunamadi"
                          );
                        }

                        const existingOverride =
                          readPayload &&
                          typeof readPayload.config_override === "object" &&
                          readPayload.config_override !== null &&
                          !Array.isArray(readPayload.config_override)
                            ? (readPayload.config_override as Record<string, unknown>)
                            : {};
                        const existingOps =
                          typeof existingOverride.ops_risk_config === "object" &&
                          existingOverride.ops_risk_config !== null &&
                          !Array.isArray(existingOverride.ops_risk_config)
                            ? (existingOverride.ops_risk_config as Record<string, unknown>)
                            : {};
                        const nextOverride = {
                          ...existingOverride,
                          ops_risk_config: {
                            ...existingOps,
                            min_score: nextThreshold,
                          },
                        };

                        const patchRes = await fetch(`/api/admin/tenants/${item.tenant_id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            config_override: nextOverride,
                          }),
                        });
                        const patchPayload = (await patchRes.json().catch(() => null)) as
                          | { error?: string }
                          | null;
                        if (!patchRes.ok) {
                          throw new Error(
                            patchPayload && "error" in patchPayload
                              ? patchPayload.error || "Tenant risk esigi kaydedilemedi"
                              : "Tenant risk esigi kaydedilemedi"
                          );
                        }

                        toast.success(`Tenant risk esigi ${nextThreshold} olarak kaydedildi`);
                      })
                    }
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {actionLoading === `threshold:${item.tenant_id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Esigi Kaydet"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() =>
                      runAction(`threshold-reset:${item.tenant_id}`, async () => {
                        const readRes = await fetch(`/api/admin/tenants/${item.tenant_id}`, {
                          cache: "no-store",
                        });
                        const readPayload = (await readRes.json().catch(() => null)) as
                          | { error?: string; config_override?: unknown }
                          | null;
                        if (!readRes.ok) {
                          throw new Error(
                            readPayload && "error" in readPayload
                              ? readPayload.error || "Tenant ayarlari okunamadi"
                              : "Tenant ayarlari okunamadi"
                          );
                        }

                        const existingOverride =
                          readPayload &&
                          typeof readPayload.config_override === "object" &&
                          readPayload.config_override !== null &&
                          !Array.isArray(readPayload.config_override)
                            ? ({ ...(readPayload.config_override as Record<string, unknown>) } as Record<string, unknown>)
                            : {};

                        const existingOps =
                          typeof existingOverride.ops_risk_config === "object" &&
                          existingOverride.ops_risk_config !== null &&
                          !Array.isArray(existingOverride.ops_risk_config)
                            ? ({
                                ...(existingOverride.ops_risk_config as Record<string, unknown>),
                              } as Record<string, unknown>)
                            : null;

                        if (existingOps) {
                          delete existingOps.min_score;
                          if (Object.keys(existingOps).length === 0) {
                            delete existingOverride.ops_risk_config;
                          } else {
                            existingOverride.ops_risk_config = existingOps;
                          }
                        }

                        const patchRes = await fetch(`/api/admin/tenants/${item.tenant_id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            config_override: existingOverride,
                          }),
                        });
                        const patchPayload = (await patchRes.json().catch(() => null)) as
                          | { error?: string }
                          | null;
                        if (!patchRes.ok) {
                          throw new Error(
                            patchPayload && "error" in patchPayload
                              ? patchPayload.error || "Tenant risk esigi sifirlanamadi"
                              : "Tenant risk esigi sifirlanamadi"
                          );
                        }

                        setThresholdDrafts((prev) => {
                          const next = { ...prev };
                          delete next[item.tenant_id];
                          return next;
                        });
                        toast.success("Tenant risk esigi defaulta alindi");
                      })
                    }
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {actionLoading === `threshold-reset:${item.tenant_id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Defaulta Don"
                    )}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
