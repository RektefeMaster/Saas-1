/**
 * Esnaf ayarları (dashboard'dan güncellenir)
 * PATCH: reminder_preference, messages, config_override (opening_message, slot_duration_minutes, vb.), contact_phone, working_hours_text
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
    const {
      reminder_preference,
      messages,
      contact_phone,
      working_hours_text,
      opening_message,
      slot_duration_minutes,
      advance_booking_days,
      cancellation_hours,
    } = body;

    const hasConfig =
      reminder_preference !== undefined ||
      messages !== undefined ||
      opening_message !== undefined ||
      slot_duration_minutes !== undefined ||
      advance_booking_days !== undefined ||
      cancellation_hours !== undefined;
    const hasTenantFields = contact_phone !== undefined || working_hours_text !== undefined;

    if (!hasConfig && !hasTenantFields) {
      return NextResponse.json(
        { error: "En az bir güncellenecek alan gerekli" },
        { status: 400 }
      );
    }

    if (reminder_preference && !REMINDER_OPTIONS.includes(reminder_preference)) {
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
    const existingMessages = (config.messages as Record<string, unknown>) || {};
    const newConfig = { ...config };

    if (reminder_preference !== undefined) {
      newConfig.reminder_preference = reminder_preference;
    }
    if (messages && typeof messages === "object") {
      newConfig.messages = { ...existingMessages };
      for (const [k, v] of Object.entries(messages)) {
        if (v !== undefined && v !== null) {
          (newConfig.messages as Record<string, unknown>)[k] = v;
        }
      }
    }
    if (opening_message !== undefined) {
      newConfig.opening_message = opening_message;
    }
    if (slot_duration_minutes !== undefined) {
      newConfig.slot_duration_minutes = slot_duration_minutes;
    }
    if (advance_booking_days !== undefined) {
      newConfig.advance_booking_days = advance_booking_days;
    }
    if (cancellation_hours !== undefined) {
      newConfig.cancellation_hours = cancellation_hours;
    }

    const updatePayload: Record<string, unknown> = {
      config_override: newConfig,
      updated_at: new Date().toISOString(),
    };
    if (contact_phone !== undefined) updatePayload.contact_phone = contact_phone;
    if (working_hours_text !== undefined) updatePayload.working_hours_text = working_hours_text;

    const { data, error } = await supabase
      .from("tenants")
      .update(updatePayload)
      .eq("id", id)
      .select("id, config_override, contact_phone, working_hours_text")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[tenant settings PATCH]", err);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}
