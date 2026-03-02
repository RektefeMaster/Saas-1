import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { loginEmailToUsernameDisplay, normalizeUsername } from "@/lib/username-auth";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard/login");
  }

  let tenant = (
    await adminSupabase
      .from("tenants")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()
  ).data;

  // user_id eşleşmezse owner_username ile dene (tenant.owner_username küçük harfle saklanıyor)
  if (!tenant && user.email) {
    const ownerUsernameRaw = loginEmailToUsernameDisplay(user.email);
    if (ownerUsernameRaw && ownerUsernameRaw !== user.email) {
      const ownerUsername = normalizeUsername(ownerUsernameRaw);
      tenant = (
        await adminSupabase
          .from("tenants")
          .select("id")
          .eq("owner_username", ownerUsername)
          .is("deleted_at", null)
          .maybeSingle()
      ).data;
    }
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
          <h2 className="text-lg font-semibold text-slate-800">
            İşletme Bulunamadı
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Hesabınıza bağlı bir işletme bulunamadı. Lütfen yönetici ile
            iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  redirect(`/dashboard/${tenant.id}`);
}
