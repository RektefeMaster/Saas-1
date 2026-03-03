"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("Global application error:", error);
    }
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Bir hata oluştu
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Uygulama yüklenirken bir sorun oluştu. Sayfayı yenileyip tekrar deneyin.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Sayfayı yenile
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
