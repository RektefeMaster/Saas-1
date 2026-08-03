"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Smartphone } from "lucide-react";
import { Input, ThemeLocaleSwitch } from "@/components/ui";
import { SiteAtmosphere } from "@/components/site/SiteAtmosphere";
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
    <div className="site-root relative min-h-screen overflow-hidden">
      <SiteAtmosphere
        src="/site/trust-secure.jpg"
        strength="veil"
        priority
        mobile="on"
        position="center"
      />
      <div className="absolute right-4 top-4 z-20">
        <ThemeLocaleSwitch compact />
      </div>

      <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12 sm:px-6">
        <section
          className="w-full rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper)" }}
        >
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/appicon.png" alt="" width={28} height={28} sizes="28px" />
            <span className="site-display text-lg" style={{ color: "var(--ahi-text)" }}>
              Ahi AI
            </span>
          </Link>
          <h1 className="mt-6 text-xl font-semibold tracking-[-0.015em]" style={{ color: "var(--ahi-text)" }}>
            {t.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
            {t.subtitle}
          </p>

          <form onSubmit={verify} className="mt-6 space-y-4">
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

            <button type="submit" disabled={loading} className="site-btn site-btn-primary w-full">
              {loading ? t.verifying : t.verify}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="font-semibold disabled:opacity-50"
              style={{ color: "var(--ahi-brand)" }}
            >
              {resending ? t.resending : t.resend}
            </button>
            <Link href="/dashboard/login" className="font-medium" style={{ color: "var(--ahi-text-2)" }}>
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
