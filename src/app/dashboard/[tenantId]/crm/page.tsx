"use client";

import dynamic from "next/dynamic";

const CrmContent = dynamic(
  () => import("./CrmContent").then((m) => ({ default: m.CrmContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center p-10">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300" />
      </div>
    ),
  }
);

export default function CrmPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  return <CrmContent params={params} />;
}
