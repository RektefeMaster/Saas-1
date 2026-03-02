/**
 * Esnaf ayarları (dashboard'dan güncellenir)
 * PATCH: reminder_preference, messages, config_override (opening_message, slot_duration_minutes, vb.), contact_phone, working_hours_text
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";
import { logTenantEvent } from "@/services/eventLog.service";

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
      ui_preferences,
      pricing_preferences,
    } = body;

    const hasConfig =
      reminder_preference !== undefined ||
      messages !== undefined ||
      opening_message !== undefined ||
      slot_duration_minutes !== undefined ||
      advance_booking_days !== undefined ||
      cancellation_hours !== undefined ||
      ui_preferences !== undefined ||
      pricing_preferences !== undefined;
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

    let fetchColumns = ["config_override", "ui_preferences"];
    const missingColumns = new Set<string>();
    let tenant: Record<string, unknown> | null = null;
    let fetchErr: { message: string } | null = null;
    for (let i = 0; i < 4; i++) {
      const result = await supabase
        .from("tenants")
        .select(fetchColumns.join(", "))
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (!result.error) {
        tenant = (result.data ?? null) as unknown as Record<string, unknown>;
        fetchErr = null;
        break;
      }
      fetchErr = { message: result.error.message };
      const missing = extractMissingSchemaColumn(result.error);
      if (!missing || missing.table !== "tenants" || !fetchColumns.includes(missing.column)) {
        break;
      }
      fetchColumns = fetchColumns.filter((c) => c !== missing.column);
      missingColumns.add(missing.column);
    }

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
    if (ui_preferences !== undefined && typeof ui_preferences === "object" && ui_preferences) {
      newConfig.ui_preferences = {
        ...((newConfig.ui_preferences as Record<string, unknown>) || {}),
        ...(ui_preferences as Record<string, unknown>),
      };
    }
    if (
      pricing_preferences !== undefined &&
      typeof pricing_preferences === "object" &&
      pricing_preferences
    ) {
      newConfig.pricing_preferences = {
        ...((newConfig.pricing_preferences as Record<string, unknown>) || {}),
        ...(pricing_preferences as Record<string, unknown>),
      };
    }

    const updatePayload: Record<string, unknown> = {
      config_override: newConfig,
      updated_at: new Date().toISOString(),
    };
    if (
      !missingColumns.has("ui_preferences") &&
      ui_preferences !== undefined &&
      typeof ui_preferences === "object" &&
      ui_preferences
    ) {
      updatePayload.ui_preferences = {
        ...((tenant.ui_preferences as Record<string, unknown>) || {}),
        ...(ui_preferences as Record<string, unknown>),
      };
    }
    if (contact_phone !== undefined) updatePayload.contact_phone = contact_phone;
    if (working_hours_text !== undefined) updatePayload.working_hours_text = working_hours_text;

    const patchPayload = { ...updatePayload };
    let selectColumns = ["id", "config_override", "ui_preferences", "contact_phone", "working_hours_text"];
    let data: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;
    for (let i = 0; i < 8; i++) {
      const result = await supabase
        .from("tenants")
        .update(patchPayload)
        .eq("id", id)
        .select(selectColumns.join(", "))
        .single();
      if (!result.error) {
        data = (result.data ?? null) as unknown as Record<string, unknown>;
        error = null;
        break;
      }
      error = { message: result.error.message };
      const missing = extractMissingSchemaColumn(result.error);
      if (!missing || missing.table !== "tenants") break;
      let changed = false;
      if (missing.column in patchPayload) {
        delete patchPayload[missing.column];
        changed = true;
      }
      if (selectColumns.includes(missing.column)) {
        selectColumns = selectColumns.filter((c) => c !== missing.column);
        changed = true;
      }
      if (!changed) break;
      missingColumns.add(missing.column);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data && missingColumns.has("ui_preferences") && data.ui_preferences === undefined) {
      data.ui_preferences = {};
    }

    await logTenantEvent({
      tenantId: id,
      eventType: "tenant.settings.updated",
      actor: "tenant",
      entityType: "tenant",
      entityId: id,
      payload: {
        keys: Object.keys(body || {}),
      },
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[tenant settings PATCH]", err);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}
