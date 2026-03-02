"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Calendar, MessageCircle, User } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { isValidUsername, usernameToLoginEmail } from "@/lib/username-auth";
import { Button, Input, Card, CardContent } from "@/components/ui";

function getErrorMessage(error: { message?: string } | null): string {
  if (!error?.message) return "Bir hata oluştu, tekrar deneyin.";
  const msg = error.message.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials"))
    return "Kullanıcı adı veya şifre hatalı.";
  if (msg.includes("email not confirmed"))
    return "Hesap doğrulaması tamamlanmamış.";
  return "Bir hata oluştu, tekrar deneyin.";
}

export default function DashboardLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    setError(null);
    const usernameTrim = username.trim().toLowerCase();
    if (!usernameTrim) {
      setError("Kullanıcı adınızı girin.");
      return false;
    }
    if (!usernameTrim.includes("@") && !isValidUsername(usernameTrim)) {
      setError("Geçerli bir kullanıcı adı girin.");
      return false;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const identifier = username.trim().toLowerCase();

      // Gizli admin girişi (publicte görünmez, sadece bilen kullanır)
      const hiddenAdminRes = await fetch("/api/admin/auth/hidden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const hiddenAdminData = (await hiddenAdminRes.json().catch(() => ({}))) as {
        requires_otp?: boolean;
        challenge_id?: string;
        error?: string;
      };
      if (hiddenAdminRes.ok) {
        if (hiddenAdminData.requires_otp && hiddenAdminData.challenge_id) {
          router.push(
            `/admin/login?from=${encodeURIComponent(
              "/admin"
            )}&mode=otp&challenge=${encodeURIComponent(hiddenAdminData.challenge_id)}`
          );
          return;
        }
        router.push("/admin");
        router.refresh();
        return;
      }
      if (hiddenAdminRes.status === 401) {
        setError(hiddenAdminData.error || "Kullanıcı adı veya şifre hatalı.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const emailForAuth = identifier.includes("@")
        ? identifier
        : usernameToLoginEmail(identifier);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password,
      });

      if (signInError) {
        setError(getErrorMessage(signInError));
        setLoading(false);
        return;
      }

      const otpRes = await fetch("/api/dashboard/auth/otp/start", { method: "POST" });
      const otpData = (await otpRes.json().catch(() => ({}))) as {
        requires_otp?: boolean;
        challenge_id?: string;
        error?: string;
      };

      if (!otpRes.ok) {
        await supabase.auth.signOut();
        setError(otpData.error || "SMS doğrulama başlatılamadı.");
        setLoading(false);
        return;
      }

      if (otpData.requires_otp && otpData.challenge_id) {
        router.push(`/dashboard/login/verify?challenge=${encodeURIComponent(otpData.challenge_id)}`);
        router.refresh();
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Bir hata oluştu, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI arkaplan"
        fill
        className="pointer-events-none object-cover opacity-[0.08] blur-[1px]"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/10" />
      {/* Sol panel - marka ve tanıtım */}
      <div className="relative hidden flex-1 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 p-10 text-white md:flex lg:p-14">
        <Link href="/" className="inline-flex items-center gap-3 text-xl font-bold tracking-tight text-white/95">
          <Image src="/appicon.png" alt="Ahi AI logo" width={36} height={36} className="rounded-lg bg-white/90 p-1 shadow-lg" />
          Ahi AI
        </Link>
        <div className="max-w-md">
          <h2 className="text-2xl font-bold leading-tight lg:text-3xl">
            Randevu ve işletme akışınızı tek panelden yönetin
          </h2>
          <p className="mt-4 text-cyan-100/90">
            Takvim, fiyat listesi, müşteri defteri ve iş akışını profesyonel şekilde yönetin.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Calendar, text: "Takvim ve müsaitlik yönetimi" },
              { icon: MessageCircle, text: "WhatsApp linki ve QR kod" },
              { icon: Mail, text: "Randevu hatırlatmaları ve bildirimler" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-white/95">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">
          © {new Date().getFullYear()} Ahi AI. Tüm hakları saklıdır.
        </p>
      </div>

      {/* Sağ panel - giriş formu */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[400px] animate-fade-in">
          <div className="mb-8 md:hidden">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-cyan-700">
              <Image src="/appicon.png" alt="Ahi AI logo" width={28} height={28} className="rounded-md bg-white p-0.5 shadow-sm" />
              Ahi AI
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              İşletme paneline giriş
            </h1>
            <p className="mt-2 text-slate-600">
              Kullanıcı adı ve şifrenizle giriş yapın, gerekiyorsa SMS doğrulamasını tamamlayın
            </p>
          </div>

          <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-none">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="group relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    id="dashboard-login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder=" "
                    autoComplete="username"
                    disabled={loading}
                    className="peer w-full rounded-xl border border-slate-200 bg-white pb-2.5 pl-10 pr-4 pt-5 text-slate-900 transition-colors placeholder-transparent focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <label
                    htmlFor="dashboard-login-username"
                    className="pointer-events-none absolute left-10 top-2 z-10 translate-y-0 text-xs text-cyan-700 transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-cyan-700 group-hover:top-2 group-hover:translate-y-0 group-hover:text-xs group-hover:text-cyan-700 dark:peer-placeholder-shown:text-slate-500 dark:peer-focus:text-cyan-300 dark:group-hover:text-cyan-300"
                  >
                    Kullanıcı adınız
                  </label>
                </div>

                <div>
                  <Input
                    label="Şifre"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    }
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  className="mt-2"
                >
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Hesabınız yok mu?{" "}
                <a href="tel:05060550239" className="font-medium text-cyan-700 hover:text-cyan-800">
                  0506 055 02 39
                </a>{" "}
                numarasıyla iletişime geçin.
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
