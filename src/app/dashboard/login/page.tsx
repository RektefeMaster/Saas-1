"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/locale-context";
import { isValidUsername, usernameToLoginEmail } from "@/lib/username-auth";
import { Button, ThemeLocaleSwitch } from "@/components/ui";

const ADMIN_LOGIN_EMAIL = "nuronuro458@gmail.com";

const COPY = {
  tr: {
    title: "İşletme Paneli Girişi",
    subtitle:
      "Kullanıcı adın ve şifrenle giriş yap. Güvenlik gerektiriyorsa SMS doğrulama adımı otomatik başlar.",
    username: "Kullanıcı adı (admin için e-posta)",
    password: "Şifre",
    submit: "Giriş Yap",
    submitting: "Giriş yapılıyor...",
    contact: "Hesabın yok mu? Kurulum için",
    back: "Ana sayfaya dön",
  },
  en: {
    title: "Business Dashboard Login",
    subtitle:
      "Sign in with your username and password. If required, SMS verification starts automatically.",
    username: "Username",
    password: "Password",
    submit: "Sign In",
    submitting: "Signing in...",
    contact: "Need an account? For onboarding call",
    back: "Back to home",
  },
} as const;

function getErrorMessage(
  error: { message?: string; description?: string; status?: number; name?: string } | null,
  locale: "tr" | "en"
): string {
  const raw = error?.message ?? (error as { description?: string })?.description ?? "";
  const tr = locale === "tr";
  if (!raw || typeof raw !== "string") return tr ? "Kullanıcı adı veya şifre hatalı." : "Invalid username or password.";
  const msg = raw.toLowerCase();

  if (
    msg.includes("invalid api key") ||
    msg.includes("apikey") ||
    msg.includes("api key") ||
    msg.includes("jwt") ||
    msg.includes("unauthorized") ||
    error?.status === 401 ||
    (error?.status === 400 && msg.includes("key"))
  ) {
    return tr
      ? "Sistem yapılandırma hatası: Supabase istemci anahtarı geçersiz."
      : "System configuration issue: invalid Supabase client key.";
  }
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials") ||
    msg.includes("invalid_grant") ||
    msg.includes("wrong password") ||
    msg.includes("incorrect password") ||
    msg.includes("invalid email or password")
  ) {
    return tr ? "Kullanıcı adı veya şifre hatalı." : "Invalid username or password.";
  }
  if (msg.includes("user not found") || msg.includes("email not found")) {
    return tr ? "Bu kullanıcı adı ile kayıtlı hesap bulunamadı." : "No account found for this username.";
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return tr ? "Çok fazla deneme. Biraz bekleyip tekrar deneyin." : "Too many attempts. Please try again later.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return tr ? "Bağlantı hatası. İnternet bağlantınızı kontrol edin." : "Network error. Check your connection.";
  }
  return tr ? "Kullanıcı adı veya şifre hatalı." : "Invalid username or password.";
}

export default function DashboardLoginPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = COPY[locale];

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const featureItems = useMemo(
    () =>
      locale === "tr"
        ? ["Canlı takvim ve kapasite yönetimi", "Müşteri Defteri notları ve hatırlatma akışları", "Operasyon uyarıları ve raporlama"]
        : ["Live calendar and capacity control", "CRM notes and reminder flows", "Operations alerts and reporting"],
    [locale]
  );

  const validate = (): boolean => {
    setError(null);
    const usernameTrim = username.trim().toLowerCase();
    if (!usernameTrim) {
      setError(locale === "tr" ? "Kullanıcı adınızı girin." : "Enter your username.");
      return false;
    }
    const isAdminEmail = usernameTrim === ADMIN_LOGIN_EMAIL;
    if (usernameTrim.includes("@") && !isAdminEmail) {
      setError(
        locale === "tr"
          ? "Sadece admin hesabı e-posta ile giriş yapabilir."
          : "Use username only, not email."
      );
      return false;
    }
    if (!isAdminEmail && !isValidUsername(usernameTrim)) {
      setError(locale === "tr" ? "Geçerli bir kullanıcı adı girin." : "Enter a valid username.");
      return false;
    }
    if (password.length < 6) {
      setError(locale === "tr" ? "Şifre en az 6 karakter olmalıdır." : "Password must be at least 6 characters.");
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
      const isAdminEmail = identifier === ADMIN_LOGIN_EMAIL;

      try {
        const hiddenAdminRes = await fetch("/api/admin/auth/hidden", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const hiddenAdminData = (await hiddenAdminRes.json().catch(() => ({}))) as {
          requires_otp?: boolean;
          challenge_id?: string;
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
        if (isAdminEmail) {
          setError(locale === "tr" ? "Admin giriş bilgileri doğrulanamadı." : "Admin login could not be verified.");
          setLoading(false);
          return;
        }
      } catch {
        // hidden admin route unreachable, continue tenant login.
        if (isAdminEmail) {
          setError(locale === "tr" ? "Admin giriş servisine ulaşılamadı." : "Admin login service is unavailable.");
          setLoading(false);
          return;
        }
      }

      let supabase;
      try {
        supabase = createClient();
      } catch (configError) {
        const configMsg = configError instanceof Error ? configError.message : String(configError);
        if (configMsg.includes("Supabase yapılandırması")) {
          setError(
            locale === "tr"
              ? "Sistem yapılandırma hatası: Supabase istemci anahtarı geçersiz."
              : "System configuration issue: invalid Supabase client key."
          );
        } else {
          setError(locale === "tr" ? "Sistem yapılandırma hatası." : "System configuration error.");
        }
        setLoading(false);
        return;
      }

      const emailForAuth = usernameToLoginEmail(identifier);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password,
      });

      if (signInError) {
        setError(getErrorMessage(signInError, locale));
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
        const otpErr = otpData.error ?? "";
        const isTenantNotFound =
          otpRes.status === 404 || /işletme bulunamadı|tenant|not found/i.test(otpErr);
        setError(
          isTenantNotFound
            ? locale === "tr"
              ? "Bu kullanıcı adı ile kayıtlı işletme bulunamadı."
              : "No business account found for this username."
            : otpErr || (locale === "tr" ? "Giriş tamamlanamadı." : "Login could not be completed.")
        );
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(getErrorMessage({ message }, locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI backdrop"
        fill
        priority
        className="pointer-events-none object-cover opacity-[0.08] blur-[1.2px]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_15%_0%,rgba(56,189,248,0.22),transparent),radial-gradient(35%_30%_at_90%_10%,rgba(16,185,129,0.18),transparent)]" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeLocaleSwitch compact />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-3xl border border-slate-200 bg-white/85 p-7 shadow-sm backdrop-blur lg:block dark:border-slate-800 dark:bg-slate-900/80">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={36}
              height={36}
              className="rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="font-mono text-sm font-semibold">Ahi AI Workspace</span>
          </Link>
          <h1 className="mt-7 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t.subtitle}</p>

          <ul className="mt-8 space-y-3">
            {featureItems.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-7">
          <div className="mb-5">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
              <Image
                src="/appicon.png"
                alt="Ahi AI"
                width={28}
                height={28}
                className="rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
              />
              Ahi AI
            </Link>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t.title}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t.username}
              </span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  autoComplete="username"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t.password}
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              {loading ? t.submitting : t.submit}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.contact}{" "}
            <a href="tel:05060550239" className="font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300">
              0506 055 02 39
            </a>
          </p>

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
              {t.back}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
