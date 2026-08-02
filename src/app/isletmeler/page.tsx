"use client";

import dynamic from "next/dynamic";
import { memo, useState } from "react";
import useSWR from "swr";
import { Search } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/swr-fetcher";
import { LottieAnimationLazy } from "@/components/ui";
import { useFuzzySearchWorker } from "@/lib/use-fuzzy-search-worker";
import { SiteShell } from "@/components/site/SiteShell";
import { MarkSpeech } from "@/components/site/GuildMarks";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

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
    cta: "WhatsApp’tan yaz",
    badge: "Aktif",
    countSuffix: "işletme",
  },
  en: {
    title: "Businesses",
    desc: "Pick a business and reach them on WhatsApp right away.",
    search: "Search business name or code...",
    empty: "No business found for your criteria.",
    loading: "Loading businesses...",
    cta: "Write on WhatsApp",
    badge: "Active",
    countSuffix: "businesses",
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
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--ahi-line)",
        background: "var(--ahi-paper)",
      }}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: "var(--ahi-line)",
              background: "var(--ahi-paper-2)",
              color: "var(--ahi-brand)",
            }}
          >
            <MarkSpeech className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--ahi-text)" }}>
              {tenant.name}
            </p>
            <p className="site-meta mt-0.5 truncate text-xs" style={{ color: "var(--ahi-text-3)" }}>
              {tenant.tenant_code}
            </p>
          </div>
        </div>
        <span
          className="site-meta shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold"
          style={{
            background: "color-mix(in oklab, var(--ahi-brand) 12%, transparent)",
            color: "var(--ahi-brand)",
          }}
        >
          {badge}
        </span>
      </div>
      <div className="px-5 pb-5 pt-4">
        <a
          href={tenant.whatsapp_link}
          target="_blank"
          rel="noreferrer"
          className="site-btn site-btn-ink w-full"
        >
          <MarkSpeech className="h-4 w-4" />
          {cta}
        </a>
      </div>
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

  const renderTenantItem = (item: unknown) => {
    const tenant = item as TenantItem;
    return <TenantCard tenant={tenant} cta={t.cta} badge={t.badge} />;
  };

  return (
    <SiteShell>
      <main>
        <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pt-14">
          <ScrollReveal variant="fadeUp">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1
                  className="site-display text-[clamp(1.9rem,4.5vw,2.75rem)]"
                  style={{ color: "var(--ahi-text)" }}
                >
                  {t.title}
                </h1>
                <p className="mt-3 max-w-xl text-[15px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
                  {t.desc}
                </p>
              </div>
              <span
                className="site-meta inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: "var(--ahi-line)",
                  background: "var(--ahi-paper)",
                  color: "var(--ahi-text-2)",
                }}
              >
                {tenants.length} {t.countSuffix}
              </span>
            </div>
          </ScrollReveal>

          <div className="relative mt-8">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--ahi-text-3)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-xl border py-3.5 pl-11 pr-4 text-sm outline-none"
              style={{
                borderColor: "var(--ahi-line)",
                background: "var(--ahi-paper)",
                color: "var(--ahi-text)",
              }}
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20">
          {loading ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-10 text-center text-sm"
              style={{
                borderColor: "var(--ahi-line)",
                background: "var(--ahi-paper)",
                color: "var(--ahi-text-3)",
              }}
            >
              <LottieAnimationLazy src="loading" width={96} height={96} />
              {t.loading}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-10 text-center text-sm"
              style={{
                borderColor: "var(--ahi-line-strong)",
                background: "var(--ahi-paper-2)",
                color: "var(--ahi-text-2)",
              }}
            >
              <LottieAnimationLazy src="empty" width={80} height={80} />
              {t.empty}
            </div>
          ) : (
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "var(--ahi-line)",
                background: "var(--ahi-paper-2)",
              }}
            >
              <VirtualList
                items={filtered as TenantItem[]}
                height={520}
                estimateSize={148}
                renderItem={renderTenantItem}
              />
            </div>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
