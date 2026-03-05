"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  MessageSquare,
  QrCode,
  Save,
  SlidersHorizontal,
  Star,
  Store,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { humanizeMinutes } from "@/lib/humanize-duration";
import { LottieAnimationLazy, QRCodeModal } from "@/components/ui";

interface TenantData {
  id: string;
  name?: string;
  contact_phone?: string | null;
  working_hours_text?: string | null;
  config_override?: {
    reminder_preference?: "off" | "customer_only" | "merchant_only" | "both";
    messages?: {
      welcome?: string;
      whatsapp_greeting?: string;
      opening_message?: string;
      confirmation?: string;
      reminder_24h?: string;
      [key: string]: unknown;
    };
    opening_message?: string;
    slot_duration_minutes?: number;
    advance_booking_days?: number;
    cancellation_hours?: number;
    pricing_preferences?: {
      fallbackLabel?: string;
      fallbackPhone?: string;
    };
    [key: string]: unknown;
  };
}

const COPY = {
  tr: {
    title: "Ayarlar",
    subtitle: "İşletme bilgilerinizi, randevu kurallarınızı ve mesaj şablonlarınızı buradan düzenleyebilirsiniz.",
    backToPanel: "Panele dön",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    saved: "Değişiklikler kaydedildi",
    saveError: "Kaydedilemedi. Lütfen tekrar deneyin.",
    loading: "Ayarlar yükleniyor...",
    loadError: "Ayarlar yüklenemedi. Lütfen sayfayı yenileyin.",

    // İletişim
    contactTitle: "İletişim ve Çalışma Saati",
    contactDesc: "Müşterilerin sizinle iletişime geçebileceği bilgiler.",
    contactPhone: "İletişim telefonu",
    contactPhoneHint: "Müşteri bilgilendirme ve acil durum mesajlarında kullanılır",
    workingHours: "Çalışma saatleri metni",
    workingHoursHint: "Örn: Hafta içi 09:00-18:00, Cumartesi 10:00-14:00",
    address: "Adres",
    addressHint: "Müşterilere gösterilecek adres",
    mapsUrl: "Google Maps linki",
    mapsUrlHint: "Opsiyonel, harita yönlendirmesi için",

    // Puanlama
    reviewTitle: "Randevu sonrası puanlama",
    reviewDesc: "Randevudan sonra müşteriye puanlama talebi gönderilsin mi?",
    reviewEnabled: "Puanlama talebi gönder",
    reviewDelayHours: "Kaç saat sonra gönderilsin",
    reviewDelayHint: "Randevu bitiminden sonra (varsayılan: 2)",

    // Randevu
    schedulingTitle: "Randevu Ayarları",
    schedulingDesc: "Randevu slot süresi, ileri rezervasyon ve iptal kuralları.",
    slotDuration: "Randevu süresi (dakika)",
    slotDurationHint: "Her randevu için ayrılan süre",
    advanceBooking: "İleri rezervasyon (gün)",
    advanceBookingHint: "Müşteriler kaç gün önceden randevu alabilsin",
    cancellationHours: "İptal süresi (saat)",
    cancellationHoursHint: "Randevudan kaç saat önce iptal yapılabilsin",

    // Hatırlatma
    reminderTitle: "Hatırlatma Ayarları",
    reminderDesc: "Randevu öncesi hatırlatma mesajlarını kim alacak?",
    reminderOff: "Kapalı",
    reminderCustomer: "Sadece müşteri",
    reminderMerchant: "Sadece siz",
    reminderBoth: "Her ikisi",

    // Mesajlar
    messagesTitle: "Mesaj Şablonları",
    messagesDesc: "Müşterilere gönderilen otomatik mesajları özelleştirin.",
    welcomeMsg: "Karşılama mesajı",
    welcomeMsgHint: "Müşteri ilk yazdığında gönderilir. {işletme_adınız} yazarsanız işletme adınız otomatik gelir",
    whatsappGreeting: "WhatsApp karşılama mesajı",
    whatsappGreetingHint: "Müşteri linke tıkladığında hazır görünen mesaj. {işletme_adınız} yazarsanız işletme adınız otomatik gelir",
    openingMessage: "Açılış mesajı",
    openingMessageHint: "Randevu sürecinde asistanın ilk sorduğu soru",
    confirmationMsg: "Onay mesajı",
    confirmationMsgHint: "Randevu onaylandığında müşteriye giden mesaj. {date} ve {time} otomatik gelir",
    reminderMsg: "Hatırlatma mesajı",
    reminderMsgHint: "Randevudan 24 saat önce gönderilir. {time} otomatik gelir",

    // Fiyat
    pricingTitle: "Fiyatı Olmayan Hizmetler",
    pricingDesc: "Fiyat girmediğiniz hizmetlerde müşteriye ne gösterilsin",
    fallbackLabel: "Gösterilecek metin",
    fallbackLabelHint: "Örn: Fiyat için arayın",
    fallbackPhone: "Aranacak telefon",
    fallbackPhoneHint: "Boş bırakırsanız iletişim telefonunuz kullanılır",

    whatsappTitle: "WhatsApp Bağlantısı",
    whatsappDesc: "Müşterilerinizin size ulaşması için link ve QR kod.",
    copyLink: "Linki kopyala",
    copied: "Kopyalandı",
    openWhatsApp: "WhatsApp'ta aç",
    showQR: "QR kod göster",
  },
  en: {
    title: "Settings",
    subtitle: "Manage business info, appointment rules, messages, and pricing.",
    backToPanel: "Back to Panel",
    save: "Save",
    saving: "Saving...",
    saved: "Changes saved",
    saveError: "Failed to save. Please try again.",
    loading: "Loading settings...",
    loadError: "Failed to load settings.",

    contactTitle: "Contact and Working Hours",
    contactDesc: "Information for customers to reach you.",
    contactPhone: "Contact phone",
    contactPhoneHint: "Used in customer routing and fallback messages",
    workingHours: "Working hours text",
    workingHoursHint: "E.g.: Mon-Fri 09:00-18:00, Sat 10:00-14:00",
    address: "Address",
    addressHint: "Address shown to customers",
    mapsUrl: "Google Maps link",
    mapsUrlHint: "Optional, for map directions",

    reviewTitle: "Post-appointment rating",
    reviewDesc: "Send rating request to customers after appointment?",
    reviewEnabled: "Send rating request",
    reviewDelayHours: "Hours after appointment",
    reviewDelayHint: "After appointment ends (default: 2)",

    schedulingTitle: "Appointment Settings",
    schedulingDesc: "Slot duration, advance booking, and cancellation rules.",
    slotDuration: "Slot duration (minutes)",
    slotDurationHint: "Time allocated per appointment (default: 30)",
    advanceBooking: "Advance booking (days)",
    advanceBookingHint: "How many days ahead can appointments be made (default: 30)",
    cancellationHours: "Cancellation window (hours)",
    cancellationHoursHint: "Hours before appointment when cancellation is allowed (default: 2)",

    reminderTitle: "Reminder Settings",
    reminderDesc: "Who receives appointment reminder messages?",
    reminderOff: "Off",
    reminderCustomer: "Customer only",
    reminderMerchant: "You only",
    reminderBoth: "Both",

    messagesTitle: "Message Templates",
    messagesDesc: "Customize automatic messages sent to customers.",
    welcomeMsg: "Welcome message",
    welcomeMsgHint: "Sent when customer first writes. {your business name} will be replaced with your business name",
    whatsappGreeting: "WhatsApp link message",
    whatsappGreetingHint: "Pre-filled message when QR/link is clicked. {your business name} will be replaced",
    openingMessage: "Opening message",
    openingMessageHint: "First question the bot asks when conversation starts",
    confirmationMsg: "Confirmation message",
    confirmationMsgHint: "Sent when appointment is confirmed. {date} and {time} are auto-filled",
    reminderMsg: "Reminder message",
    reminderMsgHint: "Sent 24 hours before appointment. {time} is auto-filled",

    pricingTitle: "Pricing Fallback",
    pricingDesc: "What to show for services without a price.",
    fallbackLabel: "Fallback label",
    fallbackLabelHint: "E.g.: Call for price",
    fallbackPhone: "Fallback phone",
    fallbackPhoneHint: "Phone to call (empty = use contact phone)",

    whatsappTitle: "WhatsApp Link",
    whatsappDesc: "Link and QR code for customers to reach you.",
    copyLink: "Copy link",
    copied: "Copied",
    openWhatsApp: "Open in WhatsApp",
    showQR: "Show QR code",
  },
} as const;

function SectionCard({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function InputField<T extends string | number>({
  label,
  hint,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
  placeholder,
  id,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  type?: "text" | "number" | "textarea";
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  id?: string;
}) {
  const inputId = id ?? `input-${label.replace(/\s/g, "-")}`;
  return (
    <div className="block">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          placeholder={placeholder}
          rows={3}
          autoComplete="off"
          className="w-full resize-y min-h-[80px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      ) : (
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) =>
            onChange((type === "number" ? Number(e.target.value) || 0 : e.target.value) as T)
          }
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      )}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export default function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];

  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // İletişim
  const [contactPhone, setContactPhone] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");

  // Puanlama
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewDelayHours, setReviewDelayHours] = useState(2);

  // Randevu
  const [slotDuration, setSlotDuration] = useState(30);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(2);

  // Hatırlatma
  const [reminderPref, setReminderPref] = useState<"off" | "customer_only" | "merchant_only" | "both">("customer_only");

  // Mesajlar
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [whatsappGreeting, setWhatsappGreeting] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");

  // Fiyat
  const [fallbackLabel, setFallbackLabel] = useState(locale === "tr" ? "Fiyat için arayın" : "Call for price");
  const [fallbackPhone, setFallbackPhone] = useState("");

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/tenant/${tenantId}/link`)
      .then((r) => r.json())
      .then((data) => setWhatsappLink(data?.whatsapp_url || null))
      .catch(() => setWhatsappLink(null));
  }, [tenantId]);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/tenant/${tenantId}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as TenantData | null;
        if (!res.ok || !data || "error" in data) {
          setLoadError(t.loadError);
          return;
        }
        setLoadError(null);
        setContactPhone(data.contact_phone || "");
        setWorkingHoursText(data.working_hours_text || "");
        setAddress((data.config_override?.address as string) || "");
        setMapsUrl((data.config_override?.maps_url as string) || "");
        setReviewEnabled((data.config_override?.review_request_enabled as boolean) ?? false);
        setReviewDelayHours(
          typeof data.config_override?.review_request_delay_hours === "number"
            ? Math.max(0, Math.min(24, data.config_override.review_request_delay_hours))
            : 2
        );

        const co = data.config_override || {};
        const msgs = (co.messages || {}) as Record<string, string>;
        const pricing = (co.pricing_preferences || {}) as Record<string, string>;

        if (typeof co.slot_duration_minutes === "number") setSlotDuration(Math.max(5, Math.min(120, co.slot_duration_minutes)));
        if (typeof co.advance_booking_days === "number") setAdvanceBookingDays(Math.max(1, Math.min(365, co.advance_booking_days)));
        if (typeof co.cancellation_hours === "number") setCancellationHours(Math.max(0, Math.min(72, co.cancellation_hours)));

        const pref = co.reminder_preference;
        if (pref && ["off", "customer_only", "merchant_only", "both"].includes(pref)) {
          setReminderPref(pref);
        }

        setWelcomeMsg(msgs.welcome || "");
        setWhatsappGreeting(msgs.whatsapp_greeting || "");
        setOpeningMessage((co.opening_message as string) || msgs.opening_message || "");
        setConfirmationMsg(msgs.confirmation || "");
        setReminderMsg(msgs.reminder_24h || "");

        setFallbackLabel(pricing.fallbackLabel || (locale === "tr" ? "Fiyat için arayın" : "Call for price"));
        setFallbackPhone(pricing.fallbackPhone || data.contact_phone || "");
      } catch {
        setLoadError(t.loadError);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locale, tenantId, t.loadError]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const slot = Math.max(5, Math.min(120, slotDuration));
      const advance = Math.max(1, Math.min(365, advanceBookingDays));
      const cancel = Math.max(0, Math.min(72, cancellationHours));

      const res = await fetch(`/api/tenant/${tenantId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_phone: contactPhone.trim() || null,
          working_hours_text: workingHoursText.trim() || null,
          address: address.trim() || undefined,
          maps_url: mapsUrl.trim() || undefined,
          review_request_enabled: reviewEnabled,
          review_request_delay_hours: reviewDelayHours,
          reminder_preference: reminderPref,
          opening_message: openingMessage.trim() || undefined,
          slot_duration_minutes: slot,
          advance_booking_days: advance,
          cancellation_hours: cancel,
          messages: {
            welcome: welcomeMsg.trim() || undefined,
            whatsapp_greeting: whatsappGreeting.trim() || undefined,
            confirmation: confirmationMsg.trim() || undefined,
            reminder_24h: reminderMsg.trim() || undefined,
          },
          pricing_preferences: {
            fallbackMode: "show_call",
            fallbackLabel: fallbackLabel.trim() || undefined,
            fallbackPhone: fallbackPhone.trim() || undefined,
          },
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2400);
      } else {
        setSaveError(t.saveError);
      }
    } catch {
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadError) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 pb-24 dark:bg-slate-950 sm:p-6 lg:p-10">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {!loadError && <LottieAnimationLazy src="loading" width={80} height={80} />}
          <p className={loadError ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}>
            {loadError ?? t.loading}
          </p>
          {loadError && tenantId && (
            <Link
              href={`/dashboard/${tenantId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.backToPanel}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-28 sm:p-6 lg:p-10">
        <header className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <Link
            href={`/dashboard/${tenantId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.backToPanel}
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </header>

        <SectionCard icon={MessageCircle} title={t.whatsappTitle} desc={t.whatsappDesc}>
          <div className="space-y-3">
            {whatsappLink ? (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="break-all text-sm font-medium text-slate-800 dark:text-slate-200">
                    {whatsappLink}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(whatsappLink);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      } catch {}
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Copy className="h-4 w-4" />
                    {linkCopied ? t.copied : t.copyLink}
                  </button>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t.openWhatsApp}
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowQRModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <QrCode className="h-4 w-4" />
                    {t.showQR}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Link yükleniyor…</p>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Store} title={t.contactTitle} desc={t.contactDesc}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label={t.contactPhone}
                hint={t.contactPhoneHint}
                value={contactPhone}
                onChange={setContactPhone}
                placeholder="+90 5XX XXX XX XX"
              />
              <InputField
                label={t.workingHours}
                hint={t.workingHoursHint}
                value={workingHoursText}
                onChange={setWorkingHoursText}
                placeholder="Hafta içi 09:00-18:00"
              />
            </div>
            <InputField
              label={t.address}
              hint={t.addressHint}
              value={address}
              onChange={setAddress}
              type="textarea"
              placeholder="Örn: Atatürk Cad. No:1, Kadıköy"
            />
            <InputField
              label={t.mapsUrl}
              hint={t.mapsUrlHint}
              value={mapsUrl}
              onChange={setMapsUrl}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </SectionCard>

        <SectionCard icon={Star} title={t.reviewTitle} desc={t.reviewDesc}>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={reviewEnabled}
                onChange={(e) => setReviewEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t.reviewEnabled}
              </span>
            </label>
            {reviewEnabled && (
              <InputField
                label={t.reviewDelayHours}
                hint={t.reviewDelayHint}
                type="number"
                value={reviewDelayHours}
                onChange={setReviewDelayHours}
                min={0}
                max={24}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Calendar} title={t.schedulingTitle} desc={t.schedulingDesc}>
          <div className="grid gap-4 sm:grid-cols-3">
            <InputField
              label={t.slotDuration}
              hint={`${t.slotDurationHint} (${humanizeMinutes(slotDuration)})`}
              type="number"
              value={slotDuration}
              onChange={setSlotDuration}
              min={5}
              max={120}
              step={5}
            />
            <InputField
              label={t.advanceBooking}
              hint={t.advanceBookingHint}
              type="number"
              value={advanceBookingDays}
              onChange={setAdvanceBookingDays}
              min={1}
              max={365}
            />
            <InputField
              label={t.cancellationHours}
              hint={t.cancellationHoursHint}
              type="number"
              value={cancellationHours}
              onChange={setCancellationHours}
              min={0}
              max={72}
            />
          </div>
        </SectionCard>

        <SectionCard icon={Bell} title={t.reminderTitle} desc={t.reminderDesc}>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "off" as const, label: t.reminderOff },
                { value: "customer_only" as const, label: t.reminderCustomer },
                { value: "merchant_only" as const, label: t.reminderMerchant },
                { value: "both" as const, label: t.reminderBoth },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                  reminderPref === opt.value
                    ? "border-slate-900 bg-slate-900 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="reminder"
                  value={opt.value}
                  checked={reminderPref === opt.value}
                  onChange={() => setReminderPref(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={MessageSquare} title={t.messagesTitle} desc={t.messagesDesc}>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {locale === "tr" ? "Karşılama" : "Greeting"}
              </p>
              <InputField
                id="msg-welcome"
                label={t.welcomeMsg}
                hint={t.welcomeMsgHint}
                value={welcomeMsg}
                onChange={setWelcomeMsg}
                type="textarea"
                placeholder="Merhaba! Ben {işletme_adınız} asistanıyım, size nasıl yardımcı olabilirim?"
              />
              <InputField
                id="msg-whatsapp"
                label={t.whatsappGreeting}
                hint={t.whatsappGreetingHint}
                value={whatsappGreeting}
                onChange={setWhatsappGreeting}
                placeholder="Merhaba {işletme_adınız} ile görüşmek istiyorum"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {locale === "tr" ? "Bot" : "Bot"}
              </p>
              <InputField
                id="msg-opening"
                label={t.openingMessage}
                hint={t.openingMessageHint}
                value={openingMessage}
                onChange={setOpeningMessage}
                type="textarea"
                placeholder="Merhaba! Ne zaman randevu almak istiyorsunuz?"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {locale === "tr" ? "Randevu sonrası" : "Post-appointment"}
              </p>
              <InputField
                id="msg-confirmation"
                label={t.confirmationMsg}
                hint={t.confirmationMsgHint}
                value={confirmationMsg}
                onChange={setConfirmationMsg}
                type="textarea"
                placeholder="Randevunuz {date} saat {time} için kaydedildi. Teşekkür ederiz!"
              />
              <InputField
                id="msg-reminder"
                label={t.reminderMsg}
                hint={t.reminderMsgHint}
                value={reminderMsg}
                onChange={setReminderMsg}
                type="textarea"
                placeholder="Yarın saat {time} randevunuz var. Lütfen unutmayın."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={SlidersHorizontal} title={t.pricingTitle} desc={t.pricingDesc}>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label={t.fallbackLabel}
              hint={t.fallbackLabelHint}
              value={fallbackLabel}
              onChange={setFallbackLabel}
              placeholder="Fiyat için arayın"
            />
            <InputField
              label={t.fallbackPhone}
              hint={t.fallbackPhoneHint}
              value={fallbackPhone}
              onChange={setFallbackPhone}
              placeholder="+90 5XX XXX XX XX"
            />
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Save className="h-4 w-4" />
            {saving ? t.saving : t.save}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <LottieAnimationLazy src="success" width={20} height={20} loop={false} />
              {t.saved}
            </span>
          )}
          {saveError && (
            <span className="text-sm font-medium text-red-600 dark:text-red-400">{saveError}</span>
          )}
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 sm:hidden">
        {saveError && (
          <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">{saveError}</p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Save className="h-4 w-4" />
          {saving ? t.saving : t.save}
        </button>
      </div>

      {tenantId && (
        <QRCodeModal
          tenantId={tenantId}
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
}
