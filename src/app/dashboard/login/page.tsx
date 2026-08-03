"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { setRememberMeCookie } from "@/lib/remember-me";
import { useLocale } from "@/lib/locale-context";
import { isValidUsername, usernameToLoginEmail } from "@/lib/username-auth";
import { ContactModal, ThemeLocaleSwitch } from "@/components/ui";
import { SiteAtmosphere } from "@/components/site/SiteAtmosphere";

const COPY = {
  tr: {
    title: "İşletme Paneli Girişi",
    subtitle:
      "Kullanıcı adın ve şifrenle giriş yap. Güvenlik gerektiriyorsa SMS doğrulama adımı otomatik başlar.",
    username: "Kullanıcı adı",
    password: "Şifre",
    rememberMe: "Beni hatırla",
    submit: "Giriş Yap",
    submitting: "Giriş yapılıyor...",
    contact: "Hesabın yok mu? Kurulum için",
    contactBtn: "İletişim",
    back: "Ana sayfaya dön",
  },
  en: {
    title: "Business Dashboard Login",
    subtitle:
      "Sign in with your username and password. If required, SMS verification starts automatically.",
    username: "Username",
    password: "Password",
    rememberMe: "Remember me",
    submit: "Sign In",
    submitting: "Signing in...",
    contact: "Need an account? For onboarding",
    contactBtn: "Contact us",
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
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const featureItems = useMemo(
    () =>
      locale === "tr"
        ? ["Canlı takvim ve kapasite yönetimi", "Müşteri Defteri notları ve hatırlatma akışları", "Canlı bildirimler ve raporlama"]
        : ["Live calendar and capacity control", "CRM notes and reminder flows", "Live alerts and reporting"],
    [locale]
  );

  const validate = (): boolean => {
    setError(null);
    const usernameTrim = username.trim().toLowerCase();
    if (!usernameTrim) {
      setError(locale === "tr" ? "Kullanıcı adınızı girin." : "Enter your username.");
      return false;
    }
    const looksLikeEmail = usernameTrim.includes("@");
    // Email-shaped identifiers are tried against hidden admin login server-side.
    if (!looksLikeEmail && !isValidUsername(usernameTrim)) {
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

      // Only probe hidden admin for email-shaped identifiers (avoids burning admin IP rate limit).
      if (identifier.includes("@")) {
        try {
          const hiddenAdminRes = await fetch("/api/admin/auth/hidden", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
          });
          const hiddenAdminData = (await hiddenAdminRes.json().catch(() => ({}))) as {
            requires_otp?: boolean;
            challenge_id?: string;
            error?: string;
            retry_after?: number;
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
          const apiError = (hiddenAdminData.error || "").trim();
          if (hiddenAdminRes.status === 429) {
            setError(
              apiError ||
                (locale === "tr"
                  ? "Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin."
                  : "Too many login attempts. Please try again in 15 minutes.")
            );
          } else if (hiddenAdminRes.status >= 500) {
            setError(
              apiError ||
                (locale === "tr"
                  ? "Admin giriş servisi şu an kullanılamıyor."
                  : "Admin login service is currently unavailable.")
            );
          } else {
            setError(
              apiError ||
                (locale === "tr"
                  ? "Admin giriş bilgileri doğrulanamadı."
                  : "Admin login could not be verified.")
            );
          }
          setLoading(false);
          return;
        } catch {
          setError(locale === "tr" ? "Admin giriş servisine ulaşılamadı." : "Admin login service is unavailable.");
          setLoading(false);
          return;
        }
      }

      setRememberMeCookie(rememberMe);

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
    <div className="site-root relative min-h-screen overflow-hidden">
      <SiteAtmosphere
        src="/site/hero-whatsapp-desk.jpg"
        strength="soft"
        priority
        mobile="on"
        position="center"
      />
      <div className="absolute right-4 top-4 z-20">
        <ThemeLocaleSwitch compact />
      </div>

      <div className="relative z-[1] mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/appicon.png" alt="" width={28} height={28} sizes="28px" />
            <span className="site-display text-xl" style={{ color: "var(--ahi-text)" }}>
              Ahi AI
            </span>
          </Link>
          <h1
            className="mt-8 text-[clamp(1.75rem,3vw,2.25rem)] font-semibold tracking-[-0.02em] leading-tight"
            style={{ color: "var(--ahi-text)" }}
          >
            {t.title}
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
            {t.subtitle}
          </p>
          <ul className="mt-8 grid gap-2.5">
            {featureItems.map((item) => (
              <li key={item} className="text-sm" style={{ color: "var(--ahi-text-3)" }}>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper)" }}
        >
          <div className="mb-6 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image src="/appicon.png" alt="" width={28} height={28} sizes="28px" />
              <span className="site-display text-lg" style={{ color: "var(--ahi-text)" }}>
                Ahi AI
              </span>
            </Link>
          </div>
          <h2 className="text-xl font-semibold tracking-[-0.015em]" style={{ color: "var(--ahi-text)" }}>
            {t.title}
          </h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--ahi-text-2)" }}>
                {t.username}
              </span>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--ahi-text-3)" }}
                />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  autoComplete="username"
                  disabled={loading}
                  className="min-h-11 w-full rounded-xl border py-2.5 pl-10 pr-3 text-base outline-none transition sm:text-sm"
                  style={{
                    borderColor: "var(--ahi-line)",
                    background: "var(--ahi-paper)",
                    color: "var(--ahi-text)",
                  }}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--ahi-text-2)" }}>
                {t.password}
              </span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--ahi-text-3)" }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="min-h-11 w-full rounded-xl border py-2.5 pl-10 pr-11 text-base outline-none transition sm:text-sm"
                  style={{
                    borderColor: "var(--ahi-line)",
                    background: "var(--ahi-paper)",
                    color: "var(--ahi-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg"
                  style={{ color: "var(--ahi-text-3)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm" style={{ color: "var(--ahi-text-2)" }}>
                {t.rememberMe}
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="site-btn site-btn-primary w-full">
              {loading ? t.submitting : t.submit}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: "var(--ahi-text-3)" }}>
            {t.contact}{" "}
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="font-semibold"
              style={{ color: "var(--ahi-brand)" }}
            >
              {t.contactBtn}
            </button>
          </p>

          <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm font-medium" style={{ color: "var(--ahi-text-2)" }}>
              {t.back}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
