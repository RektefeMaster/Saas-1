"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, MessageCircle, QrCode, X } from "lucide-react";

interface WhatsAppLinkModalProps {
  tenantId: string;
  tenantCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsAppLinkModal({
  tenantId,
  tenantCode,
  isOpen,
  onClose,
}: WhatsAppLinkModalProps) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLink = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/link`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setError(data.error || "Link alınamadı");
        return;
      }
      setLink(data.whatsapp_url || null);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (isOpen && tenantId) {
      void fetchLink();
    }
  }, [isOpen, tenantId, fetchLink]);

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

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopyalanamadı");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-link-modal-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <MessageCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <h2 id="whatsapp-link-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                WhatsApp Bağlantısı
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Müşterileriniz bu linke tıklayarak size ulaşabilir
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Yükleniyor…</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : link ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="break-all text-sm font-medium text-slate-800 dark:text-slate-200">
                  {link}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Kopyalandı" : "Kopyala"}
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  WhatsApp&apos;ta Aç
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
