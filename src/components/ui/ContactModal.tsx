"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Button } from "./Button";

const COPY = {
  tr: {
    title: "İletişim",
    subtitle: "Sorularınız veya kurulum talebiniz için bize ulaşın. En kısa sürede size dönüş yapacağız.",
    name: "Adınız",
    namePlaceholder: "Adınız Soyadınız",
    email: "E-posta",
    emailPlaceholder: "ornek@email.com",
    phone: "Telefon (isteğe bağlı)",
    phonePlaceholder: "+90 5XX XXX XX XX",
    message: "Mesajınız",
    messagePlaceholder: "Nasıl yardımcı olabiliriz?",
    send: "Gönder",
    sending: "Gönderiliyor...",
    success: "Mesajınız alındı! En kısa sürede size dönüş yapacağız.",
    close: "Kapat",
  },
  en: {
    title: "Contact",
    subtitle: "Reach out for questions or onboarding. We'll get back to you as soon as possible.",
    name: "Your name",
    namePlaceholder: "Full name",
    email: "Email",
    emailPlaceholder: "you@example.com",
    phone: "Phone (optional)",
    phonePlaceholder: "+1 XXX XXX XXXX",
    message: "Your message",
    messagePlaceholder: "How can we help?",
    send: "Send",
    sending: "Sending...",
    success: "Message received! We'll get back to you soon.",
    close: "Close",
  },
} as const;

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const { locale } = useLocale();
  const t = COPY[locale];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(locale === "tr" ? "Ad, e-posta ve mesaj zorunludur." : "Name, email and message are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          message: message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || (locale === "tr" ? "Gönderilemedi." : "Failed to send."));
        return;
      }
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setError(locale === "tr" ? "Bağlantı hatası. Tekrar deneyin." : "Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/50">
              <MessageCircle className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
            </div>
            <div>
              <h2 id="contact-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.success}
              </p>
              <Button onClick={handleClose} size="lg">
                {t.close}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.name}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.phone}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.message}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.messagePlaceholder}
                  rows={4}
                  disabled={loading}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" fullWidth size="lg" loading={loading}>
                {loading ? (
                  t.sending
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t.send}
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
