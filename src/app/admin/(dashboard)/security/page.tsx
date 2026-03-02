import {
  BadgeAlert,
  CheckCircle2,
  MessageSquareLock,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { getTwilioVerifyStatus } from "@/lib/twilio";
import { isInfoSmsEnabled } from "@/lib/sms";

export default function AdminSecurityPage() {
  const twilio = getTwilioVerifyStatus();
  const enabled = twilio.enabledByFlag;
  const operational = twilio.enabledByFlag && twilio.configReady;
  const infoSmsEnabled = isInfoSmsEnabled();
  const infoSmsFrom = process.env.TWILIO_SMS_FROM_E164 || process.env.TWILIO_PHONE_NUMBER || "";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-emerald-950/20 dark:to-cyan-950/20 sm:p-7">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
          Güvenlik Durumu
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Güvenlik ve Oturumlar
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
          Admin panel 2FA, Twilio Verify ve bilgi SMS yapılandırmalarını tek noktadan kontrol edin.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                SMS 2FA
              </p>
              <p
                className={`mt-2 text-lg font-bold ${
                  operational ? "text-emerald-600 dark:text-emerald-300" : enabled ? "text-amber-600 dark:text-amber-300" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {operational ? "Etkin ve Çalışıyor" : enabled ? "Açık ama Eksik" : "Devre Dışı"}
              </p>
            </div>
            {operational ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : enabled ? (
              <TriangleAlert className="h-5 w-5 text-amber-500" />
            ) : (
              <ShieldOff className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            `ENABLE_SMS_2FA` değişkeni ile kontrol edilir.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Twilio Verify
              </p>
              <p
                className={`mt-2 text-lg font-bold ${
                  twilio.configReady ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"
                }`}
              >
                {twilio.configReady ? "Hazır" : "Eksik Konfigürasyon"}
              </p>
            </div>
            {twilio.configReady ? (
              <MessageSquareLock className="h-5 w-5 text-emerald-500" />
            ) : (
              <BadgeAlert className="h-5 w-5 text-red-500" />
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` zorunludur.
          </p>
          {twilio.missing.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">
              Eksik: {twilio.missing.join(", ")}
            </p>
          )}
          {twilio.invalid.length > 0 && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
              Geçersiz: {twilio.invalid.join(", ")}
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Bilgi SMS
              </p>
              <p
                className={`mt-2 text-lg font-bold ${
                  infoSmsEnabled ? "text-emerald-600 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {infoSmsEnabled ? "Etkin" : "Devre Dışı"}
              </p>
            </div>
            <Smartphone className={`h-5 w-5 ${infoSmsEnabled ? "text-emerald-500" : "text-slate-400"}`} />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            `ENABLE_INFO_SMS` ve gönderici numarası ile yönetilir.
          </p>
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            FROM: {infoSmsFrom || "Tanımlı değil"}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Kontrol Listesi</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Production geçişinden önce aşağıdaki maddeleri doğrulayın.
        </p>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            `ENABLE_SMS_2FA=true` ise Twilio Verify ayarlarının tamamı geçerli olmalı.
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            Admin girişi için test OTP akışı staging ve production ortamında ayrı doğrulanmalı.
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            Bilgi SMS açık ise `TWILIO_SMS_FROM_E164` gönderici numarası doğrulanmış olmalı.
          </li>
        </ul>
      </section>
    </div>
  );
}
