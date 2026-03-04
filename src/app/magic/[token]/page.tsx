import Link from "next/link";
import { redirect } from "next/navigation";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { supabase } from "@/lib/supabase";

async function consumeMagicToken(token: string): Promise<{ tenantId: string } | { error: string }> {
  const nowIso = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("magic_links")
    .select("token, tenant_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    const missingTable = extractMissingSchemaTable(error);
    if (missingTable === "magic_links") {
      return { error: "Magic link altyapisi hazir degil. Migration 028 uygulanmamis." };
    }
    return { error: "Magic link dogrulanamadi." };
  }

  if (!row) {
    return { error: "Magic link bulunamadi veya gecersiz." };
  }

  if (row.used_at) {
    return { error: "Bu magic link daha once kullanildi." };
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { error: "Bu magic link suresi dolmus." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("magic_links")
    .update({ used_at: nowIso })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("tenant_id")
    .maybeSingle();

  if (updateError) {
    return { error: "Magic link kullanima alinamadi." };
  }

  if (!updated?.tenant_id) {
    return { error: "Magic link aktif degil (kullanilmis veya suresi dolmus)." };
  }

  return { tenantId: updated.tenant_id as string };
}

export default async function MagicTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Gecersiz baglanti</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Magic link tokeni gecersiz.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-cyan-700 underline dark:text-cyan-300">
            Ana sayfaya don
          </Link>
        </div>
      </div>
    );
  }

  const result = await consumeMagicToken(token);
  if ("tenantId" in result) {
    redirect(`/t/${result.tenantId}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Magic link kullanilamadi</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{result.error}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-cyan-700 underline dark:text-cyan-300">
          Ana sayfaya don
        </Link>
      </div>
    </div>
  );
}
