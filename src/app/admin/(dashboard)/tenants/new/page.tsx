"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isValidUsername } from "@/lib/username-auth";

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
  "İşletme Bilgileri",
  "Sahip Hesabı ve Telefon Doğrulama",
  "Takvim ve Çalışma Saatleri",
  "Hizmetler ve Fiyat Listesi",
  "CRM ve Müşteri İletişimi",
  "Marka ve Görünüm",
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

  const [ownerUsername, setOwnerUsername] = useState("");
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
      if (!ownerUsername.trim() || !password.trim() || password.length < 6) {
        setError("Kullanıcı adı, şifre (min 6 karakter) ve sahip telefonu zorunludur.");
        return false;
      }
      if (!isValidUsername(ownerUsername.trim().toLowerCase())) {
        setError("Kullanıcı adı 3-32 karakter, küçük harf/rakam/nokta/tire olmalı.");
        return false;
      }
      const phone = ownerPhone.trim();
      if (!phone || !phone.startsWith("+")) {
        setError("Sahip cep telefonu uluslararası formatta olmalı (örn: +905551234567).");
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
      owner_username: ownerUsername.trim().toLowerCase(),
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
    <div className="space-y-6">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        ← İşletmeler listesine dön
      </Link>

      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/60 to-emerald-50/70 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-cyan-950/20 dark:to-emerald-950/20 sm:p-7">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Yeni İşletme Sihirbazı
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">{progress}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STEP_TITLES.map((title, index) => {
            const isActive = index === step;
            const isDone = index < step;
            return (
              <div
                key={title}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isActive
                    ? "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200"
                    : isDone
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <p className="font-semibold">{isDone ? "Tamam" : `Adım ${index + 1}`}</p>
                <p className="mt-0.5 truncate">{title}</p>
              </div>
            );
          })}
        </div>
      </section>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
            {success}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                İşletme Adı
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Mehmet Berber Salonu"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                required
              />
              <p className="mt-1 text-xs text-slate-500">Müşterilere görünen resmi işletme adı</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                İşletme Kodu
              </label>
              <input
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value.toUpperCase().slice(0, 12))}
                placeholder="Örn: MEHMET01"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-mono uppercase"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                QR kod ve randevu linki için kullanılır. Benzersiz olmalı, büyük harf ve rakam.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                İşletme Tipi
              </label>
              <select
                value={businessTypeId}
                onChange={(e) => setBusinessTypeId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                required
              >
                <option value="">Seçin: Berber, Kuaför, Klinik, vb.</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "suspended")}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="active">Aktif (randevu alınabilir)</option>
                <option value="inactive">Pasif (geçici kapalı)</option>
                <option value="suspended">Askıda</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                İşletme Sahibinin Panele Giriş Kullanıcı Adı
              </label>
              <input
                type="text"
                value={ownerUsername}
                onChange={(e) => setOwnerUsername(e.target.value.toLowerCase())}
                placeholder="Örn: mehmet.berber"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Küçük harf, rakam, nokta veya tire. İşletme paneli girişinde bu kullanıcı adı kullanılacak.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                required
                minLength={6}
              />
              <p className="mt-1 text-xs text-slate-500">İşletme sahibi bu şifre ile panele giriş yapacak</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                İşletme Sahibinin Cep Telefonu
              </label>
              <input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Örn: +905551234567"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Uluslararası formatta (ülke kodu + numara). Girişte SMS doğrulama ve kampanya bildirimleri için kullanılır. Zorunlu.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={sms2faEnabled}
                onChange={(e) => setSms2faEnabled(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">SMS ile giriş doğrulama</span>
                <p className="text-xs text-slate-500">Açıksa sahip her girişte telefona gelen kodu girecek</p>
              </div>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Randevu slot süresi (dk)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value) || 30)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Her randevu hücresi (örn: 30 dakika)</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">İleri rezervasyon (gün)</label>
                <input
                  type="number"
                  min={1}
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(Number(e.target.value) || 30)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Kaç gün sonrasına randevu alınabilir</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">İptal süresi (saat)</label>
                <input
                  type="number"
                  min={1}
                  value={cancellationHours}
                  onChange={(e) => setCancellationHours(Number(e.target.value) || 2)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Randevudan kaç saat önce iptal edilebilir</p>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Haftalık çalışma saatleri</label>
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
              <p className="mt-2 text-xs text-slate-500">Her gün için açılış-kapanış saati</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Kapalı günler (tatil, bayram vb.)</p>
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
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Randevu alınabilecek hizmetleri tanımlayın. En az bir hizmet girin.
            </p>
            {services.map((service, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6">
                <input
                  value={service.name}
                  onChange={(e) => updateService(index, { name: e.target.value })}
                  placeholder="Hizmet adı (örn: Saç Kesimi)"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  value={service.description}
                  onChange={(e) => updateService(index, { description: e.target.value })}
                  placeholder="Kısa açıklama"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={service.duration_minutes}
                  onChange={(e) => updateService(index, { duration_minutes: Number(e.target.value) || 30 })}
                  placeholder="Süre (dk)"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={service.price}
                  onChange={(e) => updateService(index, { price: e.target.value })}
                  placeholder="Fiyat (₺)"
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
              + Hizmet ekle
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Müşterilere gösterilecek iletişim telefonu</label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Örn: +905551234567 (randevu linkinde ve &quot;Bizi arayın&quot; için)"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Boş bırakırsanız sahip telefonu kullanılır</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Çalışma saatleri metni</label>
              <input
                value={workingHoursText}
                onChange={(e) => setWorkingHoursText(e.target.value)}
                placeholder="Örn: Hafta içi 09:00-18:00, Cumartesi 10:00-14:00"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Müşterilere gösterilecek özet çalışma saatleri</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">CRM müşteri etiketleri (virgülle ayırın)</label>
              <input
                value={crmTags}
                onChange={(e) => setCrmTags(e.target.value)}
                placeholder="Örn: VIP, Düzenli, Yeni"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Müşterileri kategorize etmek için varsayılan etiketler</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hatırlatma kanalı</label>
              <select
                value={crmReminderChannel}
                onChange={(e) => setCrmReminderChannel(e.target.value as "panel" | "whatsapp" | "both")}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="both">WhatsApp + SMS (önerilen)</option>
                <option value="whatsapp">Sadece WhatsApp</option>
                <option value="panel">Sadece panel bildirimi</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">Randevu hatırlatmaları hangi kanala gidecek</p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Panel teması</label>
              <select
                value={themePreset}
                onChange={(e) => setThemePreset(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="modern">Modern</option>
                <option value="classic">Klasik</option>
                <option value="midnight">Gece</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ana renk</label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 px-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Vurgu rengi</label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 px-2"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Panelde görünecek modüller</label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
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
                    {key === "overview" && "Özet"}
                    {key === "calendar" && "Takvim"}
                    {key === "pricing" && "Fiyat Listesi"}
                    {key === "workflow" && "İş Akışı"}
                    {key === "crm" && "CRM Defteri"}
                    {key === "settings" && "Ayarlar"}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 0 || loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            Geri
          </button>
          {!isLastStep ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              İleri
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              {loading ? "Oluşturuluyor..." : "İşletmeyi Oluştur"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
