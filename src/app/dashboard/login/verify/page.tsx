"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Smartphone } from "lucide-react";
import { Button, Input, ThemeLocaleSwitch } from "@/components/ui";
import { useLocale } from "@/lib/locale-context";

const COPY = {
  tr: {
    title: "SMS Doğrulama",
    subtitle: "Telefonunuza gelen doğrulama kodunu girin.",
    code: "Doğrulama kodu",
    verify: "Doğrula ve Devam Et",
    verifying: "Doğrulanıyor...",
    resend: "Kodu tekrar gönder",
    resending: "Gönderiliyor...",
    back: "Giriş ekranına dön",
    missing: "OTP oturumu bulunamadı. Lütfen tekrar giriş yapın.",
    invalid: "Doğrulama kodunu girin.",
  },
  en: {
    title: "SMS Verification",
    subtitle: "Enter the verification code sent to your phone.",
    code: "Verification code",
    verify: "Verify and Continue",
    verifying: "Verifying...",
    resend: "Resend code",
    resending: "Sending...",
    back: "Back to login",
    missing: "OTP session not found. Please login again.",
    invalid: "Please enter the verification code.",
  },
} as const;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = useMemo(() => searchParams.get("challenge") || "", [searchParams]);
  const { locale } = useLocale();
  const t = COPY[locale];

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      setError(t.missing);
      return;
    }
    if (code.trim().length < 4) {
      setError(t.invalid);
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch("/api/dashboard/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error || (locale === "tr" ? "Kod doğrulanamadı." : "Code verification failed."));
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    const response = await fetch("/api/dashboard/auth/otp/start", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as {
      challenge_id?: string;
      error?: string;
    };
    setResending(false);
    if (!response.ok || !payload.challenge_id) {
      setError(payload.error || (locale === "tr" ? "Kod tekrar gönderilemedi." : "Failed to resend code."));
      return;
    }
    router.replace(`/dashboard/login/verify?challenge=${encodeURIComponent(payload.challenge_id)}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI backdrop"
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover opacity-[0.07]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_15%_0%,rgba(56,189,248,0.2),transparent),radial-gradient(35%_30%_at_90%_10%,rgba(16,185,129,0.17),transparent)]" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeLocaleSwitch compact />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-7">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={28}
              height={28}
              sizes="28px"
              className="rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
            />
            Ahi AI
          </Link>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.subtitle}</p>

          <form onSubmit={verify} className="mt-5 space-y-4">
            <Input
              label={t.code}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              autoFocus
              disabled={loading}
              maxLength={8}
              leftIcon={<Smartphone className="h-4 w-4" />}
            />

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              {loading ? t.verifying : t.verify}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="font-semibold text-cyan-700 hover:text-cyan-800 disabled:opacity-50 dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              {resending ? t.resending : t.resend}
            </button>
            <Link href="/dashboard/login" className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
              {t.back}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardLoginVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <VerifyForm />
    </Suspense>
  );
}
