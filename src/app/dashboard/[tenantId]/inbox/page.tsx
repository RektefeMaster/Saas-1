"use client";

import dynamic from "next/dynamic";

const InboxContent = dynamic(
  () => import("./InboxContent").then((m) => ({ default: m.InboxContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center p-10">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300" />
      </div>
    ),
  }
);

export default function InboxPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  return <InboxContent params={params} />;
}
