"use client";

import { useEffect } from "react";
import { Download, QrCode, X } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

const COPY = {
  tr: {
    title: "WhatsApp QR Kodu",
    subtitle: "Müşterileriniz bu kodu tarayarak size WhatsApp üzerinden yazabilir.",
    download: "PNG İndir",
    close: "Kapat",
  },
  en: {
    title: "WhatsApp QR Code",
    subtitle: "Customers can scan this code to reach you on WhatsApp.",
    download: "Download PNG",
    close: "Close",
  },
} as const;

interface QRCodeModalProps {
  tenantId: string;
  tenantCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ tenantId, tenantCode, isOpen, onClose }: QRCodeModalProps) {
  const { locale } = useLocale();
  const t = COPY[locale];

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

  if (!isOpen) return null;

  const qrUrl = `/api/tenant/${tenantId}/qr?format=png`;
  const downloadFilename = `${tenantCode || "qr"}-qr.png`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <QrCode className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <h2 id="qr-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center gap-5">
            <div className="flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-inner dark:border-slate-700 dark:bg-slate-800/50">
              <img
                src={qrUrl}
                alt="WhatsApp QR Code"
                className="h-56 w-56 object-contain"
                width={224}
                height={224}
              />
            </div>
            <a
              href={qrUrl}
              download={downloadFilename}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" />
              {t.download}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
