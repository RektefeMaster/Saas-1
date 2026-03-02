"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, Loader2, Smartphone } from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button, Input, Card, CardContent } from "@/components/ui";

function AdminOtpBridge() {
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";
  const hiddenMode = searchParams.get("mode");
  const challengeId = useMemo(() => searchParams.get("challenge") || "", [searchParams]);
  const otpFlowReady = hiddenMode === "otp" && challengeId.length > 0;

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpFlowReady) return;
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
        setError(data.error || "Kod doğrulanamadı");
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
              <Image
                src="/appicon.png"
                alt="Ahi AI logo"
                width={42}
                height={42}
                className="rounded-lg bg-white p-0.5 shadow-md"
              />
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Ahi AI
              </span>
            </Link>
          </div>

          <Card className="border border-slate-200 shadow-lg dark:border-slate-800">
            <CardContent className="p-6 sm:p-8">
              {otpFlowReady ? (
                <>
                  <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Admin Doğrulama
                    </h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">
                      Telefonunuza gelen SMS kodunu girin.
                    </p>
                  </div>
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
                  </form>
                </>
              ) : (
                <div className="space-y-5 text-center">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Doğrudan Admin Girişi Kapalı
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400">
                    Güvenlik nedeniyle admin girişi sadece işletme giriş ekranındaki gizli akıştan
                    başlatılır.
                  </p>
                  <Link
                    href="/dashboard/login"
                    className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    İşletme Girişine Dön
                  </Link>
                </div>
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
      <AdminOtpBridge />
    </Suspense>
  );
}
