"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ShieldCheck, Smartphone } from "lucide-react";
import { Button, Card, CardContent, Input } from "@/components/ui";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = useMemo(() => searchParams.get("challenge") || "", [searchParams]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      setError("OTP oturumu bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }
    if (code.trim().length < 4) {
      setError("Doğrulama kodunu girin.");
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
      setError(payload.error || "Kod doğrulanamadı.");
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
      setError(payload.error || "Kod tekrar gönderilemedi.");
      return;
    }
    router.replace(`/dashboard/login/verify?challenge=${encodeURIComponent(payload.challenge_id)}`);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI arkaplan"
        fill
        className="pointer-events-none object-cover opacity-[0.08] blur-[1px]"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/10" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/appicon.png" alt="Ahi AI logo" width={36} height={36} className="rounded-lg bg-white p-0.5 shadow-sm" />
            <span className="text-xl font-semibold tracking-tight text-slate-900">Ahi AI</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">SMS doğrulama</h1>
          <p className="mt-2 text-sm text-slate-600">
            Güvenlik için telefonunuza gelen doğrulama kodunu girin.
          </p>
        </div>

        <Card className="border border-slate-200 bg-white/95 backdrop-blur">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={verify} className="space-y-5">
              <Input
                label="Doğrulama kodu"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
                disabled={loading}
                maxLength={8}
                leftIcon={<Smartphone className="h-4 w-4" />}
              />

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" fullWidth size="lg" loading={loading}>
                {loading ? "Doğrulanıyor..." : "Doğrula ve Devam Et"}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="font-medium text-cyan-700 hover:text-cyan-800 disabled:opacity-50"
              >
                {resending ? "Gönderiliyor..." : "Kodu tekrar gönder"}
              </button>
              <Link
                href="/dashboard/login"
                className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
              >
                <ShieldCheck className="h-4 w-4" />
                Girişe dön
              </Link>
            </div>
          </CardContent>
        </Card>
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
