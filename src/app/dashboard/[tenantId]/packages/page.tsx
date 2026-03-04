"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, PackagePlus } from "lucide-react";

interface FeatureResponse {
  feature_flags?: {
    packages?: boolean;
  };
}

interface PackageItem {
  id: string;
  name: string;
  service_slug: string;
  total_sessions: number;
  price: number;
  validity_days: number | null;
  is_active: boolean;
  created_at: string;
}

interface CustomerPackageItem {
  id: string;
  customer_phone: string;
  package_id: string;
  total_sessions: number;
  remaining_sessions: number;
  purchased_at: string;
  expires_at: string | null;
  status: "active" | "completed" | "expired" | "cancelled";
  packages?: {
    id?: string;
    name?: string;
    service_slug?: string;
  } | null;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PackagesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [packagesEnabled, setPackagesEnabled] = useState(false);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackageItem[]>([]);

  const [newPackage, setNewPackage] = useState({
    name: "",
    service_slug: "",
    total_sessions: 8,
    price: "",
    validity_days: "",
  });

  const [assignForm, setAssignForm] = useState({
    customer_phone: "",
    package_id: "",
  });

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const loadData = useCallback(async () => {
    if (!tenantId || !packagesEnabled) return;
    setLoading(true);
    setError("");

    const [packagesRes, customerPackagesRes] = await Promise.all([
      fetch(`/api/tenant/${tenantId}/packages`, { cache: "no-store" }),
      fetch(`/api/tenant/${tenantId}/customer-packages`, { cache: "no-store" }),
    ]);

    const packagesPayload = await packagesRes.json().catch(() => []);
    const customerPackagesPayload = await customerPackagesRes.json().catch(() => []);

    if (!packagesRes.ok) {
      setError(packagesPayload?.error || "Paketler alınamadı.");
      setPackages([]);
      setCustomerPackages([]);
      setLoading(false);
      return;
    }

    if (!customerPackagesRes.ok) {
      setError(customerPackagesPayload?.error || "Müşteri paketleri alınamadı.");
      setPackages(Array.isArray(packagesPayload) ? packagesPayload : []);
      setCustomerPackages([]);
      setLoading(false);
      return;
    }

    setPackages(Array.isArray(packagesPayload) ? packagesPayload : []);
    setCustomerPackages(Array.isArray(customerPackagesPayload) ? customerPackagesPayload : []);
    setLoading(false);
  }, [packagesEnabled, tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    setFeaturesLoading(true);
    fetch(`/api/tenant/${tenantId}/features`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: FeatureResponse) => {
        const enabled = Boolean(payload?.feature_flags?.packages);
        setPackagesEnabled(enabled);
      })
      .catch(() => setPackagesEnabled(false))
      .finally(() => setFeaturesLoading(false));
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedCustomerPackages = useMemo(
    () =>
      [...customerPackages].sort(
        (a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
      ),
    [customerPackages]
  );

  const createPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newPackage.name.trim() || !newPackage.service_slug.trim()) return;

    setSaving(true);
    setError("");
    setInfo("");

    const res = await fetch(`/api/tenant/${tenantId}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPackage.name.trim(),
        service_slug: newPackage.service_slug.trim(),
        total_sessions: newPackage.total_sessions,
        price:
          newPackage.price.trim() && !Number.isNaN(Number(newPackage.price))
            ? Number(newPackage.price)
            : 0,
        validity_days:
          newPackage.validity_days.trim() && !Number.isNaN(Number(newPackage.validity_days))
            ? Number(newPackage.validity_days)
            : null,
      }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaving(false);
      setError(payload?.error || "Paket oluşturulamadı.");
      return;
    }

    setSaving(false);
    setInfo("Paket oluşturuldu.");
    setNewPackage({ name: "", service_slug: "", total_sessions: 8, price: "", validity_days: "" });
    await loadData();
  };

  const assignPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !assignForm.customer_phone.trim() || !assignForm.package_id) return;

    setSaving(true);
    setError("");
    setInfo("");

    const res = await fetch(`/api/tenant/${tenantId}/customer-packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_phone: assignForm.customer_phone.trim(),
        package_id: assignForm.package_id,
      }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaving(false);
      setError(payload?.error || "Müşteriye paket atanamadı.");
      return;
    }

    setSaving(false);
    setInfo("Paket müşteriye atandı.");
    setAssignForm({ customer_phone: "", package_id: "" });
    await loadData();
  };

  const consumeOneSession = async (customerPackageId: string) => {
    if (!tenantId) return;
    setSaving(true);
    setError("");
    setInfo("");

    const res = await fetch(`/api/tenant/${tenantId}/customer-packages/${customerPackageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consume_one: true }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaving(false);
      setError(payload?.error || "Seans düşürülemedi.");
      return;
    }

    setSaving(false);
    setInfo("1 seans düşürüldü.");
    await loadData();
  };

  return (
    <div className="space-y-6 p-4 pb-24 sm:p-6 lg:p-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Panele Dön
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Paket & Seans
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          Hizmete bağlı paket tanımlayın, müşteriye atayın ve seans kalanını takip edin.
        </p>
        {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p>}
        {info && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{info}</p>}
      </header>

      {featuresLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Özellik kontrol ediliyor...
        </section>
      ) : !packagesEnabled ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          Bu işletme tipinde paket modülü kapalı görünüyor (`feature_flags.packages=false`).
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Yeni Paket</h2>
            <form onSubmit={createPackage} className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <input
                value={newPackage.name}
                onChange={(e) => setNewPackage((s) => ({ ...s, name: e.target.value }))}
                placeholder="Paket adı"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
                required
              />
              <input
                value={newPackage.service_slug}
                onChange={(e) => setNewPackage((s) => ({ ...s, service_slug: e.target.value }))}
                placeholder="service_slug"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
                required
              />
              <input
                type="number"
                min={1}
                value={newPackage.total_sessions}
                onChange={(e) =>
                  setNewPackage((s) => ({ ...s, total_sessions: Number(e.target.value) || 1 }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={newPackage.price}
                onChange={(e) => setNewPackage((s) => ({ ...s, price: e.target.value }))}
                placeholder="Fiyat"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  min={0}
                  value={newPackage.validity_days}
                  onChange={(e) =>
                    setNewPackage((s) => ({ ...s, validity_days: e.target.value }))
                  }
                  placeholder="Geçerlilik (gün)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Ekle
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Müşteriye Paket Ata
            </h2>
            <form onSubmit={assignPackage} className="grid gap-2 md:grid-cols-3">
              <input
                value={assignForm.customer_phone}
                onChange={(e) => setAssignForm((s) => ({ ...s, customer_phone: e.target.value }))}
                placeholder="Müşteri telefonu"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
                required
              />
              <select
                value={assignForm.package_id}
                onChange={(e) => setAssignForm((s) => ({ ...s, package_id: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40"
                required
              >
                <option value="">Paket seç</option>
                {packages
                  .filter((pkg) => pkg.is_active)
                  .map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.service_slug})
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Ata
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Paket Tanımları
            </h2>
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Yükleniyor...</p>
            ) : packages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Henüz paket yok.</p>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg) => (
                  <article
                    key={pkg.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {pkg.name} ({pkg.service_slug})
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pkg.total_sessions} seans • {pkg.price} TL • Geçerlilik: {pkg.validity_days ?? "sınırsız"} gün
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Müşteri Paketleri
            </h2>
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Yükleniyor...</p>
            ) : sortedCustomerPackages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Atanmış paket yok.</p>
            ) : (
              <div className="space-y-2">
                {sortedCustomerPackages.map((cp) => (
                  <article
                    key={cp.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {cp.customer_phone} • {cp.packages?.name || "Paket"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Kalan: {cp.remaining_sessions}/{cp.total_sessions} • Durum: {cp.status} • Satın alma: {formatDate(cp.purchased_at)} • Son: {formatDate(cp.expires_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => consumeOneSession(cp.id)}
                      disabled={saving || cp.status !== "active" || cp.remaining_sessions <= 0}
                      className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      1 Seans Düş
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
