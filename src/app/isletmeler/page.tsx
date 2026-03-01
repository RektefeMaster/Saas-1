"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Building2, ArrowLeft } from "lucide-react";

interface TenantItem {
  id: string;
  name: string;
  tenant_code: string;
  whatsapp_link: string;
}

export default function IsletmelerPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/tenants")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setTenants(data) : setTenants([])))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI arkaplan"
        fill
        priority
        className="pointer-events-none object-cover opacity-[0.08] blur-[1.5px]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-blue-500/12" />
      <header className="relative z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            <Image src="/appicon.png" alt="Ahi AI logo" width={28} height={28} className="rounded-md bg-white p-0.5 shadow-sm" />
            Ahi AI
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana sayfa
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Randevu alabileceğiniz işletmeler
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            İşletmeyi seçip WhatsApp üzerinden randevu alın
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              İşletmeler yükleniyor...
            </p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Building2 className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Henüz kayıtlı işletme yok
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Yakında burada listelenecek işletmelerden randevu alabileceksiniz.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Ana sayfaya dön
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {tenants.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                    <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {t.name}
                    </p>
                    <p className="font-mono text-sm text-slate-500 dark:text-slate-400">
                      {t.tenant_code}
                    </p>
                  </div>
                </div>
                <a
                  href={t.whatsapp_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp ile Randevu Al
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← Ana sayfaya dön
          </Link>
        </p>
      </main>
    </div>
  );
}
