"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button, Input, Card, CardContent } from "@/components/ui";

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
    <div className="relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI arkaplan"
        fill
        className="pointer-events-none object-cover opacity-[0.08] blur-[1px]"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/10" />
      <div className="absolute right-4 top-4 z-20 flex items-center gap-3">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-[420px] animate-fade-in">
          <div className="mb-8 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <Image src="/appicon.png" alt="Ahi AI logo" width={42} height={42} className="rounded-lg bg-white p-0.5 shadow-md" />
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Ahi AI
              </span>
            </Link>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Yönetim paneli
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {step === "password"
                ? "Yetkili şifresi ile devam edin"
                : "Telefonunuza gelen SMS kodunu doğrulayın"}
            </p>
          </div>

          <Card className="border border-slate-200 shadow-lg dark:border-slate-800">
            <CardContent className="p-6 sm:p-8">
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
                    leftIcon={<Lock className="h-4 w-4" />}
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
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
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

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={resending}
                      className="inline-flex items-center gap-1 font-medium text-cyan-700 transition hover:text-cyan-800 disabled:opacity-50"
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
                      Şifreye dön
                    </button>
                  </div>
                </form>
              )}

              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Bu panel sadece yetkili kişiler içindir.
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              ← Ana sayfaya dön
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
