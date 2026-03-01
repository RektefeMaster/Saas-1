"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BusinessType {
  id: string;
  name: string;
}

interface ServiceDraft {
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
  price_visible: boolean;
  is_active: boolean;
}

interface SlotDraft {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BlockedDraft {
  start_date: string;
  end_date: string;
  reason: string;
}

const STEP_TITLES = [
  "Temel Kimlik",
  "Sahip Hesabı ve Güvenlik",
  "Takvim ve Çalışma Modeli",
  "Fiyat Listesi",
  "CRM ve İletişim",
  "Marka ve Panel Özelleştirme",
];

const DEFAULT_SLOTS: SlotDraft[] = [1, 2, 3, 4, 5].map((day) => ({
  day_of_week: day,
  start_time: "09:00",
  end_time: "18:00",
}));

export default function NewTenantWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [types, setTypes] = useState<BusinessType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [businessTypeId, setBusinessTypeId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "suspended">("active");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [sms2faEnabled, setSms2faEnabled] = useState(true);

  const [slotDuration, setSlotDuration] = useState(30);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(2);
  const [weeklySlots, setWeeklySlots] = useState<SlotDraft[]>(DEFAULT_SLOTS);
  const [blockedDates, setBlockedDates] = useState<BlockedDraft[]>([]);
  const [blockedDraft, setBlockedDraft] = useState<BlockedDraft>({
    start_date: "",
    end_date: "",
    reason: "",
  });

  const [services, setServices] = useState<ServiceDraft[]>([
    {
      name: "Saç Kesimi",
      description: "",
      duration_minutes: 30,
      price: "",
      price_visible: true,
      is_active: true,
    },
  ]);

  const [crmTags, setCrmTags] = useState("VIP, Düzenli");
  const [crmReminderChannel, setCrmReminderChannel] = useState<"panel" | "whatsapp" | "both">(
    "both"
  );
  const [contactPhone, setContactPhone] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState("Hafta içi 09:00-18:00");

  const [themePreset, setThemePreset] = useState("modern");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#06b6d4");
  const [moduleVisibility, setModuleVisibility] = useState({
    overview: true,
    calendar: true,
    pricing: true,
    workflow: true,
    crm: true,
    settings: true,
  });

  useEffect(() => {
    fetch("/api/admin/business-types")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setTypes(data as BusinessType[]) : setTypes([])))
      .catch(() => setTypes([]));
  }, []);

  const isLastStep = step === STEP_TITLES.length - 1;

  const progress = useMemo(
    () => `${step + 1}/${STEP_TITLES.length} • ${STEP_TITLES[step]}`,
    [step]
  );

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!name.trim() || !tenantCode.trim() || !businessTypeId) {
        setError("İşletme adı, kodu ve işletme tipi gereklidir.");
        return false;
      }
    }
    if (step === 1) {
      if (!email.trim() || !password.trim() || password.length < 6) {
        setError("Geçerli e-posta ve en az 6 karakter şifre girin.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    setError(null);
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const prevStep = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const updateService = (index: number, patch: Partial<ServiceDraft>) => {
    setServices((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validateStep()) return;

    setLoading(true);
    const payload = {
      name: name.trim(),
      tenant_code: tenantCode.trim().toUpperCase(),
      business_type_id: businessTypeId,
      status,
      email: email.trim(),
      password,
      owner_phone_e164: ownerPhone.trim() || null,
      security_config: {
        sms_2fa_enabled: sms2faEnabled,
      },
      scheduling: {
        slot_duration_minutes: slotDuration,
        advance_booking_days: advanceBookingDays,
        cancellation_hours: cancellationHours,
        weekly_slots: weeklySlots,
        blocked_dates: blockedDates,
      },
      services: services
        .filter((service) => service.name.trim())
        .map((service, index) => ({
          name: service.name.trim(),
          description: service.description.trim(),
          duration_minutes: service.duration_minutes,
          price: service.price.trim() ? Number(service.price) : null,
          price_visible: service.price_visible,
          is_active: service.is_active,
          display_order: index,
        })),
      crm: {
        default_tags: crmTags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        reminder_channel: crmReminderChannel,
      },
      config_override: {
        contact_phone: contactPhone.trim() || null,
        working_hours_text: workingHoursText.trim() || null,
      },
      ui_preferences: {
        themePreset,
        primaryColor,
        accentColor,
        moduleVisibility,
        moduleOrder: ["overview", "calendar", "pricing", "workflow", "crm", "settings"],
      },
      pricing_preferences: {
        fallbackMode: "show_call",
        fallbackLabel: "Fiyat için arayın",
        fallbackPhone: contactPhone.trim() || ownerPhone.trim() || null,
      },
    };

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(data.error || "İşletme oluşturulamadı");
        setLoading(false);
        return;
      }
      setSuccess("İşletme başarıyla oluşturuldu.");
      setTimeout(() => {
        if (data.id) router.push(`/admin/tenants/${data.id}`);
        else router.push("/admin/tenants");
      }, 900);
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← Kiracılar listesine dön
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Yeni İşletme Sihirbazı
      </h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-400">{progress}</p>

      <form onSubmit={submit} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="İşletme adı"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              required
            />
            <input
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value.toUpperCase().slice(0, 12))}
              placeholder="Tenant kodu (AHI001)"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-mono uppercase"
              required
            />
            <select
              value={businessTypeId}
              onChange={(e) => setBusinessTypeId(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              required
            >
              <option value="">İşletme tipi seçin</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "suspended")}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="suspended">Askıda</option>
            </select>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Sahip e-postası"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifre (min 6)"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              required
            />
            <input
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="Owner telefon (E.164)"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={sms2faEnabled}
                onChange={(e) => setSms2faEnabled(e.target.checked)}
              />
              SMS 2FA etkin
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <input
                type="number"
                min={5}
                step={5}
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value) || 30)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                type="number"
                min={1}
                value={advanceBookingDays}
                onChange={(e) => setAdvanceBookingDays(Number(e.target.value) || 30)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                type="number"
                min={1}
                value={cancellationHours}
                onChange={(e) => setCancellationHours(Number(e.target.value) || 2)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {weeklySlots.map((slot, index) => (
                <div key={`${slot.day_of_week}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                  <select
                    value={slot.day_of_week}
                    onChange={(e) =>
                      setWeeklySlots((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, day_of_week: Number(e.target.value) } : item
                        )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value={1}>Pzt</option>
                    <option value={2}>Sal</option>
                    <option value={3}>Çar</option>
                    <option value={4}>Per</option>
                    <option value={5}>Cum</option>
                    <option value={6}>Cmt</option>
                    <option value={0}>Paz</option>
                  </select>
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) =>
                      setWeeklySlots((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, start_time: e.target.value } : item
                        )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) =>
                      setWeeklySlots((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, end_time: e.target.value } : item
                        )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Kapalı gün ekle (opsiyonel)</p>
              <div className="grid gap-2 md:grid-cols-4">
                <input
                  type="date"
                  value={blockedDraft.start_date}
                  onChange={(e) => setBlockedDraft((d) => ({ ...d, start_date: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="date"
                  value={blockedDraft.end_date}
                  onChange={(e) => setBlockedDraft((d) => ({ ...d, end_date: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  value={blockedDraft.reason}
                  onChange={(e) => setBlockedDraft((d) => ({ ...d, reason: e.target.value }))}
                  placeholder="Sebep"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!blockedDraft.start_date || !blockedDraft.end_date) return;
                    setBlockedDates((prev) => [...prev, blockedDraft]);
                    setBlockedDraft({ start_date: "", end_date: "", reason: "" });
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Ekle
                </button>
              </div>
              {blockedDates.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {blockedDates.map((blocked, index) => (
                    <li key={`${blocked.start_date}-${index}`}>
                      {blocked.start_date} - {blocked.end_date} {blocked.reason ? `(${blocked.reason})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {services.map((service, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6">
                <input
                  value={service.name}
                  onChange={(e) => updateService(index, { name: e.target.value })}
                  placeholder="Hizmet adı"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  value={service.description}
                  onChange={(e) => updateService(index, { description: e.target.value })}
                  placeholder="Açıklama"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={service.duration_minutes}
                  onChange={(e) => updateService(index, { duration_minutes: Number(e.target.value) || 30 })}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={service.price}
                  onChange={(e) => updateService(index, { price: e.target.value })}
                  placeholder="Fiyat"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={service.price_visible}
                    onChange={(e) => updateService(index, { price_visible: e.target.checked })}
                  />
                  Fiyat göster
                </label>
                <button
                  type="button"
                  onClick={() => setServices((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700"
                >
                  Sil
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setServices((prev) => [
                  ...prev,
                  {
                    name: "",
                    description: "",
                    duration_minutes: 30,
                    price: "",
                    price_visible: true,
                    is_active: true,
                  },
                ])
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              + Hizmet satırı ekle
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={crmTags}
              onChange={(e) => setCrmTags(e.target.value)}
              placeholder="CRM etiketleri (virgül ile)"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
            <select
              value={crmReminderChannel}
              onChange={(e) => setCrmReminderChannel(e.target.value as "panel" | "whatsapp" | "both")}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="both">Panel + WhatsApp</option>
              <option value="panel">Sadece panel</option>
              <option value="whatsapp">Sadece WhatsApp</option>
            </select>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="İletişim telefonu"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
            <input
              value={workingHoursText}
              onChange={(e) => setWorkingHoursText(e.target.value)}
              placeholder="Çalışma saat metni"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <select
                value={themePreset}
                onChange={(e) => setThemePreset(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="modern">Modern</option>
                <option value="classic">Classic</option>
                <option value="midnight">Midnight</option>
              </select>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-[46px] rounded-xl border border-slate-300 px-1.5"
              />
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-[46px] rounded-xl border border-slate-300 px-1.5"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {Object.entries(moduleVisibility).map(([key, value]) => (
                <label key={key} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) =>
                      setModuleVisibility((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 0 || loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Geri
          </button>
          {!isLastStep ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              İleri
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Oluşturuluyor..." : "İşletmeyi Oluştur"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
