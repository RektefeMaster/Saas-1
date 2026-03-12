"use client";

import dynamic from "next/dynamic";
import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Building2, MessageCircle, Search, Store } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/swr-fetcher";
import { LottieAnimationLazy, ThemeLocaleSwitch } from "@/components/ui";
import { useFuzzySearchWorker } from "@/lib/use-fuzzy-search-worker";

const VirtualList = dynamic(
  () => import("@/components/ui/VirtualList").then((m) => ({ default: m.VirtualList })),
  { ssr: false }
);

interface TenantItem {
  id: string;
  name: string;
  tenant_code: string;
  whatsapp_link: string;
}

const COPY = {
  tr: {
    title: "İşletmeler",
    desc: "İşletme seçin, WhatsApp üzerinden hemen iletişime geçin.",
    search: "İşletme adı veya kodu ara...",
    empty: "Aradığınız kriterde işletme bulunamadı.",
    loading: "İşletmeler yükleniyor...",
    cta: "İletişime Geç",
    back: "Ana sayfa",
    badge: "Aktif İşletme",
  },
  en: {
    title: "Live Business Directory",
    desc: "Pick a business and take action quickly through WhatsApp or digital channels.",
    search: "Search business name or code...",
    empty: "No business found for your criteria.",
    loading: "Loading businesses...",
    cta: "Contact",
    back: "Home",
    badge: "Active Business",
  },
} as const;

const TenantCard = memo(function TenantCard({
  tenant,
  cta,
  badge,
}: {
  tenant: TenantItem;
  cta: string;
  badge: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
              {tenant.tenant_code}
            </p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {badge}
        </span>
      </div>
      <a
        href={tenant.whatsapp_link}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
      >
        <MessageCircle className="h-4 w-4" />
        {cta}
      </a>
    </div>
  );
});

export default function IsletmelerPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [search, setSearch] = useState("");

  const { data: tenants = [], isLoading: loading } = useSWR<TenantItem[]>(
    "/api/public/tenants",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { result: filtered } = useFuzzySearchWorker({
    list: tenants,
    query: search,
    keys: ["name", "tenant_code"],
    threshold: 0.4,
  });

  const renderTenantItem = (tenant: TenantItem, index: number) => (
    <TenantCard tenant={tenant} cta={t.cta} badge={t.badge} />
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI backdrop"
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover opacity-[0.07] blur-[1px]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_30%_at_20%_0%,rgba(56,189,248,0.17),transparent),radial-gradient(40%_30%_at_90%_10%,rgba(16,185,129,0.15),transparent)]" />

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-semibold">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={30}
              height={30}
              sizes="30px"
              className="rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
            />
            <span>Ahi AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={t.back}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.back}</span>
            </Link>
            <ThemeLocaleSwitch compact />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{t.desc}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Building2 className="h-3.5 w-3.5" />
            {tenants.length}
          </span>
        </div>

        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-500"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <LottieAnimationLazy src="loading" width={96} height={96} />
            {t.loading}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
            <LottieAnimationLazy src="empty" width={80} height={80} />
            {t.empty}
          </div>
        ) : (
          <VirtualList
            items={filtered as TenantItem[]}
            height={500}
            estimateSize={140}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            renderItem={renderTenantItem}
          />
        )}
      </main>
    </div>
  );
}
