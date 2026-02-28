/**
 * Esnaf ayarları (dashboard'dan güncellenir)
 * PATCH: reminder_preference güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const REMINDER_OPTIONS = ["off", "customer_only", "merchant_only", "both"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reminder_preference } = body;

    if (!reminder_preference || !REMINDER_OPTIONS.includes(reminder_preference)) {
      return NextResponse.json(
        { error: "reminder_preference: off | customer_only | merchant_only | both" },
        { status: 400 }
      );
    }

    const { data: tenant, error: fetchErr } = await supabase
      .from("tenants")
      .select("config_override")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !tenant) {
      return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
    }

    const config = (tenant.config_override as Record<string, unknown>) || {};
    const newConfig = { ...config, reminder_preference };

    const { data, error } = await supabase
      .from("tenants")
      .update({
        config_override: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, config_override")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[tenant settings PATCH]", err);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}
