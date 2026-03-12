"use client";

import { memo, useCallback, useState } from "react";

export const DashboardCodeCopy = memo(function DashboardCodeCopy({
  tenantCode,
}: {
  tenantCode?: string | null;
}) {
  const [codeCopied, setCodeCopied] = useState(false);

  const copyCode = useCallback(() => {
    if (!tenantCode) return;
    navigator.clipboard.writeText(tenantCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [tenantCode]);

  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-sm text-slate-500 dark:text-slate-400">Kod:</span>
      <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {tenantCode}
      </code>
      <button
        type="button"
        onClick={copyCode}
        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title="Kodu kopyala"
      >
        {codeCopied ? "✓ Kopyalandı" : "Kopyala"}
      </button>
    </div>
  );
});
