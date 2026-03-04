"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Command, Zap, Plus, Activity, Power } from "lucide-react";
import { cn } from "@/lib/cn";

const HELP_ITEMS = [
  {
    icon: Command,
    title: "Hızlı Gezinme (⌘K)",
    desc: "Herhangi bir sayfadayken ⌘K veya Ctrl+K ile komut paletini açın. İşletme adı yazarak doğrudan detaya gidebilir veya sayfa adı ile hızlıca geçiş yapabilirsiniz.",
  },
  {
    icon: Plus,
    title: "Quick Add",
    desc: "İşletmeler sayfasında sağ üstteki 'Quick Add' ile sadece isim, tip ve telefon girerek 60 saniyede yeni işletme açın. Otomatik tenant kodu, kullanıcı adı ve geçici şifre üretilir.",
  },
  {
    icon: Zap,
    title: "Satır İşlemleri",
    desc: "Her işletme satırında: Giriş Yap (dashboard'a geç), +1 Hafta / +1 Ay (abonelik uzat), Limit (aylık mesaj kotası), Botu Durdur/Başlat, Düzenle (detay sayfası).",
  },
  {
    icon: Activity,
    title: "Sistem Sağlığı",
    desc: "Sol alt köşedeki renkli gösterge: yeşil = sağlıklı, turuncu = Sentry hatası var, gri = sistem donduruldu. Tıklayarak Araçlar sayfasına gidin.",
  },
  {
    icon: Power,
    title: "Kill Switch",
    desc: "Header'daki 'Sistemi Dondur' ile tüm WhatsApp botlarını tek tıkla durdurabilirsiniz. Acil durumlarda kullanın. 'Sistemi Çöz' ile normale döner.",
  },
];

export function AdminHelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400">
            <Command className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nasıl Kullanılır?
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Admin panel kısayolları ve hızlı işlemler
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>
      <div
        className={cn(
          "grid gap-0 overflow-hidden transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0">
          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            <ul className="space-y-4">
              {HELP_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
