import { getTwilioVerifyStatus } from "@/lib/twilio";

export default function AdminSecurityPage() {
  const twilio = getTwilioVerifyStatus();
  const enabled = twilio.enabledByFlag;
  const operational = twilio.enabledByFlag && twilio.configReady;

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Güvenlik ve Oturumlar
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Yönetim paneli için 2FA ve SMS doğrulama yapılandırma durumu.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SMS 2FA</p>
          <p
            className={`mt-2 text-lg font-semibold ${
              operational ? "text-emerald-600" : enabled ? "text-amber-600" : "text-slate-600"
            }`}
          >
            {operational ? "Etkin (Çalışıyor)" : enabled ? "Açık ama Çalışmıyor" : "Devre Dışı"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            `ENABLE_SMS_2FA` değeri ile yönetilir.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Twilio Verify</p>
          <p className={`mt-2 text-lg font-semibold ${twilio.configReady ? "text-emerald-600" : "text-red-600"}`}>
            {twilio.configReady ? "Hazır" : "Eksik / Geçersiz Konfigürasyon"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` gerekir.
          </p>
          {twilio.missing.length > 0 && (
            <p className="mt-2 text-xs font-medium text-red-600">
              Eksik: {twilio.missing.join(", ")}
            </p>
          )}
          {twilio.invalid.length > 0 && (
            <p className="mt-1 text-xs font-medium text-red-600">
              Geçersiz: {twilio.invalid.join(", ")}
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
