"use client";

import { Loader2 } from "lucide-react";

interface MessageSettingsProps {
  welcomeMsg: string;
  whatsappGreeting: string;
  onWelcomeChange: (v: string) => void;
  onWhatsappGreetingChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function MessageSettings({
  welcomeMsg,
  whatsappGreeting,
  onWelcomeChange,
  onWhatsappGreetingChange,
  onSave,
  saving,
}: MessageSettingsProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-purple-50/30 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-purple-950/20">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-xl">💬</span> Mesaj Ayarları
      </h3>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Müşterilere gönderilen karşılama ve WhatsApp mesajlarını özelleştirin.
      </p>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Karşılama mesajı
          </label>
          <input
            type="text"
            value={welcomeMsg}
            onChange={(e) => onWelcomeChange(e.target.value)}
            placeholder="Merhaba! Ben {tenant_name} asistanıyım, size nasıl yardımcı olabilirim?"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Müşteri ilk yazdığında gönderilen mesaj. {"{tenant_name}"} yerine işletme adı yazılır.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            WhatsApp link mesajı
          </label>
          <input
            type="text"
            value={whatsappGreeting}
            onChange={(e) => onWhatsappGreetingChange(e.target.value)}
            placeholder="Merhaba {tenant_name} ile görüşmek istiyorum"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Müşteri QR kod veya linke tıkladığında WhatsApp&apos;ta hazır görünen mesaj. {"{tenant_name}"} yerine işletme adı yazılır.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50 dark:from-slate-200 dark:to-slate-100 dark:text-slate-900 dark:hover:from-slate-100 dark:hover:to-slate-200 sm:w-auto"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kaydediliyor…
            </span>
          ) : (
            "Mesajları Kaydet"
          )}
        </button>
      </div>
    </div>
  );
}
