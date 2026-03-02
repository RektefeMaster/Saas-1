"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button, Input } from "@/components/ui";

function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [step, setStep] = useState<"password" | "otp">("password");
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";
  const hiddenMode = searchParams.get("mode");
  const hiddenChallenge = searchParams.get("challenge");

  useEffect(() => {
    if (hiddenMode === "otp" && hiddenChallenge) {
      setStep("otp");
      setChallengeId(hiddenChallenge);
    }
  }, [hiddenChallenge, hiddenMode]);

  const stepLabel = useMemo(
    () =>
      step === "password"
        ? "Adım 1/2 · Yetki doğrulama"
        : "Adım 2/2 · SMS doğrulama",
    [step]
  );

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        requires_otp?: boolean;
        challenge_id?: string;
      };

      if (!res.ok) {
        setError(data.error || "Giriş başarısız");
        setLoading(false);
        return;
      }

      if (data.requires_otp && data.challenge_id) {
        setChallengeId(data.challenge_id);
        setStep("otp");
        setLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      setError("OTP oturumu bulunamadı. Şifre adımına dönün.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code: otpCode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "Kod doğrulanamadı");
        setLoading(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!password) {
      setError("Önce şifre adımına dönüp tekrar deneyin.");
      return;
    }
    setError("");
    setResending(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        requires_otp?: boolean;
        challenge_id?: string;
      };
      if (!res.ok || !data.requires_otp || !data.challenge_id) {
        setError(data.error || "Kod tekrar gönderilemedi");
        setResending(false);
        return;
      }
      setChallengeId(data.challenge_id);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI arkaplan"
        fill
        className="pointer-events-none object-cover opacity-[0.08]"
        priority
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-600/10" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-700/10" />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6">
        <div className="grid w-full gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden rounded-3xl border border-slate-200/70 bg-white/80 p-7 shadow-sm backdrop-blur lg:block dark:border-slate-800 dark:bg-slate-900/70">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/appicon.png"
                alt="Ahi AI"
                width={34}
                height={34}
                className="rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Ahi AI
                </p>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Yönetim Erişimi</p>
              </div>
            </Link>

            <h1 className="mt-7 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Güvenli Yönetim Girişi
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Bu alan sadece yetkili ekip için tasarlanmıştır. Şifre doğrulamasından sonra SMS kodu ile ikinci adım güvenlik uygulanır.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Güvenlik Katmanı
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Şifre + Twilio SMS OTP
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Erişim Sonrası
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  İşletme yönetimi, güvenlik ve canlı operasyon
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {step === "password" ? (
                  <KeyRound className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                )}
                {stepLabel}
              </div>
              <Link
                href="/"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Ana Sayfa
              </Link>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {step === "password" ? "Yönetim Girişi" : "SMS Kod Onayı"}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {step === "password"
                  ? "Yönetici şifresi ile ilk adımı tamamlayın."
                  : "Telefonunuza gelen 6 haneli SMS kodunu girin."}
              </p>
            </div>

            {step === "password" ? (
              <form onSubmit={submitPassword} className="space-y-5">
                <Input
                  label="Yönetici Şifresi"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  minLength={8}
                  disabled={loading}
                  autoComplete="current-password"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" loading={loading}>
                  {loading ? "Kontrol ediliyor..." : "Devam Et"}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="space-y-5">
                <Input
                  label="SMS Doğrulama Kodu"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  autoFocus
                  required
                  disabled={loading}
                  leftIcon={<Smartphone className="h-4 w-4" />}
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" loading={loading}>
                  {loading ? "Doğrulanıyor..." : "Girişi Tamamla"}
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 font-medium text-cyan-700 transition hover:text-cyan-800 disabled:opacity-50 dark:text-cyan-300 dark:hover:text-cyan-200"
                  >
                    <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
                    {resending ? "Gönderiliyor..." : "Kodu tekrar gönder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("password");
                      setOtpCode("");
                      setChallengeId("");
                      setError("");
                    }}
                    className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Şifre adımına dön
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Bu alan sadece yetkili yönetim ekibi içindir.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
