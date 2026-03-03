"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Button, Input, ThemeLocaleSwitch } from "@/components/ui";

const COPY = {
  tr: {
    step1: "Adım 1/2 · Yetki doğrulama",
    step2: "Adım 2/2 · SMS doğrulama",
    titlePassword: "Yönetim Girişi",
    titleOtp: "SMS Kod Onayı",
    subtitlePassword: "Yönetici e-posta ve şifresi ile ilk adımı tamamlayın.",
    subtitleOtp: "Telefonunuza gelen SMS kodunu girin.",
    email: "Yönetici E-postası",
    password: "Yönetici Şifresi",
    otp: "SMS Doğrulama Kodu",
    continue: "Devam Et",
    checking: "Kontrol ediliyor...",
    complete: "Girişi Tamamla",
    verifying: "Doğrulanıyor...",
    resend: "Kodu tekrar gönder",
    resending: "Gönderiliyor...",
    goBack: "Şifre adımına dön",
    home: "Ana Sayfa",
    secureTitle: "Güvenli Yönetim Girişi",
    secureDesc:
      "Bu alan yalnızca yetkili ekip içindir. Şifre doğrulamasından sonra SMS ile ikinci adım güvenlik uygulanır.",
    errorEmail: "Geçerli bir e-posta adresi girin.",
    errorPassword: "Şifre en az 8 karakter olmalıdır.",
    errorConnection: "Bağlantı hatası",
    errorOtpMissing: "OTP oturumu bulunamadı. Şifre adımına dönün.",
    footer: "Bu alan sadece yetkili yönetim ekibi içindir.",
  },
  en: {
    step1: "Step 1/2 · Credential verification",
    step2: "Step 2/2 · SMS verification",
    titlePassword: "Admin Login",
    titleOtp: "SMS Code Verification",
    subtitlePassword: "Complete the first step with admin email and password.",
    subtitleOtp: "Enter the SMS code sent to your phone.",
    email: "Admin Email",
    password: "Admin Password",
    otp: "SMS Verification Code",
    continue: "Continue",
    checking: "Checking...",
    complete: "Complete Login",
    verifying: "Verifying...",
    resend: "Resend code",
    resending: "Sending...",
    goBack: "Back to password step",
    home: "Home",
    secureTitle: "Secure Admin Access",
    secureDesc:
      "This area is restricted to authorized staff. After password verification, SMS is used as the second security layer.",
    errorEmail: "Enter a valid email address.",
    errorPassword: "Password must be at least 8 characters.",
    errorConnection: "Connection error",
    errorOtpMissing: "OTP session not found. Return to password step.",
    footer: "This area is restricted to authorized management staff.",
  },
} as const;

function AdminLoginForm() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [email, setEmail] = useState("");
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
    () => (step === "password" ? t.step1 : t.step2),
    [step, t.step1, t.step2]
  );

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !emailTrim.includes("@")) {
      setError(t.errorEmail);
      return;
    }
    if (!password || password.length < 8) {
      setError(t.errorPassword);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        requires_otp?: boolean;
        challenge_id?: string;
      };

      if (!res.ok) {
        const errorMsg = data.error || (locale === "tr" ? "Giriş başarısız" : "Login failed");
        setError(errorMsg);
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
      setError(t.errorConnection);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      setError(t.errorOtpMissing);
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
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error || (locale === "tr" ? "Kod doğrulanamadı" : "Code verification failed"));
        setLoading(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError(t.errorConnection);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!email || !password) {
      setError(t.errorOtpMissing);
      return;
    }
    setError("");
    setResending(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        requires_otp?: boolean;
        challenge_id?: string;
      };
      if (!res.ok || !data.requires_otp || !data.challenge_id) {
        setError(data.error || (locale === "tr" ? "Kod tekrar gönderilemedi" : "Code resend failed"));
        setResending(false);
        return;
      }
      setChallengeId(data.challenge_id);
    } catch {
      setError(t.errorConnection);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI backdrop"
        fill
        priority
        className="pointer-events-none object-cover opacity-[0.08]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_20%_0%,rgba(56,189,248,0.18),transparent),radial-gradient(40%_35%_at_85%_10%,rgba(16,185,129,0.17),transparent)]" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeLocaleSwitch compact />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6">
        <div className="grid w-full gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden rounded-3xl border border-slate-200/80 bg-white/85 p-7 shadow-sm backdrop-blur lg:block dark:border-slate-800 dark:bg-slate-900/80">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/appicon.png"
                alt="Ahi AI"
                width={34}
                height={34}
                className="rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="font-mono text-sm font-semibold">Ahi AI Admin</span>
            </Link>

            <h1 className="mt-7 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t.secureTitle}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.secureDesc}
            </p>

            <div className="mt-7 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                {locale === "tr" ? "Çok katmanlı güvenlik" : "Multi-layer security"}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                {locale === "tr" ? "Rol tabanlı yönetim erişimi" : "Role-based management access"}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-6">
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
                {t.home}
              </Link>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {step === "password" ? t.titlePassword : t.titleOtp}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                {step === "password" ? t.subtitlePassword : t.subtitleOtp}
              </p>
            </div>

            {step === "password" ? (
              <form onSubmit={submitPassword} className="space-y-5">
                <Input
                  label={t.email}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  autoFocus
                  required
                  disabled={loading}
                  autoComplete="email"
                  leftIcon={<Mail className="h-4 w-4" />}
                />
                <Input
                  label={t.password}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
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
                  {loading ? t.checking : t.continue}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="space-y-5">
                <Input
                  label={t.otp}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                  {loading ? t.verifying : t.complete}
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 font-medium text-cyan-700 transition hover:text-cyan-800 disabled:opacity-50 dark:text-cyan-300 dark:hover:text-cyan-200"
                  >
                    <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
                    {resending ? t.resending : t.resend}
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
                    {t.goBack}
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">{t.footer}</p>
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
