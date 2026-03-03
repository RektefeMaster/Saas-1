"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("Application error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Bir hata oluştu
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Sayfa yüklenirken bir sorun oluştu. Yenileyip tekrar deneyin.
          </p>
        </div>
        <Button
          onClick={reset}
          variant="primary"
          size="md"
        >
          Sayfayı yenile
        </Button>
      </div>
    </div>
  );
}
