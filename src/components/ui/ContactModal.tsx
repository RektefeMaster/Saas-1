"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageCircle, X, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Button } from "./Button";

const contactSchema = z.object({
  name: z.string().min(1, "Ad zorunludur").max(120, "Ad çok uzun"),
  email: z.string().min(1, "E-posta zorunludur").email("Geçerli bir e-posta girin"),
  phone: z.string().optional(),
  message: z.string().min(1, "Mesaj zorunludur").max(2000, "Mesaj çok uzun"),
});

type ContactFormData = z.infer<typeof contactSchema>;

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError: setFormError,
    clearErrors,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

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

  const onSubmit = async (data: ContactFormData) => {
    clearErrors("root");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone?.trim() || undefined,
          message: data.message.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError("root", { message: json.error || (locale === "tr" ? "Gönderilemedi." : "Failed to send.") });
        return;
      }
      setSuccess(true);
      reset();
    } catch {
      setFormError("root", { message: locale === "tr" ? "Bağlantı hatası. Tekrar deneyin." : "Connection error. Please try again." });
    }
  };

  const handleClose = () => {
    setSuccess(false);
    clearErrors();
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.name}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  {...register("name")}
                  placeholder={t.namePlaceholder}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.email}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  {...register("email")}
                  placeholder={t.emailPlaceholder}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.phone}
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  {...register("phone")}
                  placeholder={t.phonePlaceholder}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.message}
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  {...register("message")}
                  placeholder={t.messagePlaceholder}
                  disabled={isSubmitting}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {errors.message && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.message.message}</p>
                )}
              </div>

              {errors.root && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errors.root.message}</span>
                </div>
              )}

              <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
                {isSubmitting ? (
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
