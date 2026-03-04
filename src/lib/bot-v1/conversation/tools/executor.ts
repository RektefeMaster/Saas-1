import { supabase } from "../../../supabase";
import { sendWhatsAppMessage } from "../../../whatsapp";
import { getDailyAvailability, reserveAppointment } from "@/services/booking.service";
import { getCustomerLastActiveAppointment, cancelAppointment } from "@/services/cancellation.service";
import { addToWaitlist, notifyWaitlist } from "@/services/waitlist.service";
import { createRecurringAppointment, dayOfWeekToTurkish } from "@/services/recurring.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import { isCancelConfirmation } from "../intent-detection";
import { formatDateTr, formatDateReadableTr } from "../helpers";
import { localDateStr, formatSlotDateTimeTr } from "../context-builder";
import { todayStr } from "@/lib/dayjs-utils";
import { withRetry } from "@/lib/retry";
import type { ConversationState } from "../../../database.types";
import type { MergedConfig } from "@/types/botConfig.types";
import {
  notifyNewAppointmentForMerchant,
  notifyRescheduledAppointmentForMerchant,
} from "@/services/merchantNotification.service";
import {
  checkCustomerPackage,
  consumeCustomerPackageSession,
} from "@/services/package.service";
import { matchServiceToSlug } from "./match-service";

export interface ToolExecResult {
  result: Record<string, unknown>;
  sessionDeleted?: boolean;
  sessionUpdate?: Partial<ConversationState>;
}

async function checkAndNotifyWaitlist(
  tenantId: string,
  dateStr: string,
  configOverride?: Record<string, unknown>
): Promise<void> {
  const daily = await getDailyAvailability(tenantId, dateStr, { configOverride });
  if (daily.available.length === 0) return;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  await notifyWaitlist(tenantId, dateStr, daily.available, tenant?.name || "İşletme");
}

async function getAppointmentDate(appointmentId: string): Promise<string | null> {
  const { data } = await supabase
    .from("appointments")
    .select("slot_start")
    .eq("id", appointmentId)
    .single();
  if (!data) return null;
  const parsed = new Date(data.slot_start);
  if (isNaN(parsed.getTime())) return null;
  return localDateStr(parsed);
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  tenantId: string,
  customerPhone: string,
  lastUserMessage: string,
  state: ConversationState | null,
  configOverride?: Record<string, unknown>,
  mergedConfig?: MergedConfig | null
): Promise<ToolExecResult> {
  if (name === "check_availability") {
    const dateStr = args.date as string;
    const serviceSlug = (args.service_slug as string | undefined) || undefined;
    const staffId = (args.staff_id as string | undefined)?.trim() || undefined;
    const daily = await getDailyAvailability(tenantId, dateStr, {
      configOverride,
      staffId,
      serviceSlug,
      customerPhone,
    });
    const availability = {
      available: daily.available,
      booked: daily.booked,
      blocked: daily.blocked,
      closed: daily.closed,
      noSchedule: daily.noSchedule,
    };
    let status: string;
    if (availability.blocked) status = "blocked_holiday";
    else if (availability.closed) status = "closed_day";
    else if (availability.available.length === 0) status = "fully_booked";
    else status = "has_available_slots";

    return {
      result: {
        date: dateStr,
        date_readable: formatDateTr(dateStr),
        status,
        available: availability.available,
        booked_count: availability.booked.length,
      },
      sessionUpdate: {
        step: "saat_secimi_bekleniyor",
        extracted: {
          ...(state?.extracted || {}),
          last_availability_date: dateStr,
          last_available_slots: availability.available,
        },
      },
    };
  }

  if (name === "match_service") {
    const userText = (args.user_text as string)?.trim() ?? "";
    const matchResult = await matchServiceToSlug(tenantId, userText);
    return { result: matchResult as unknown as Record<string, unknown> };
  }

  if (name === "create_appointment") {
    const dateStr = args.date as string;
    const timeStr = args.time as string;
    const advanceDays = mergedConfig?.advance_booking_days ?? (configOverride?.advance_booking_days as number) ?? 30;
    const todayStrVal = todayStr();
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + advanceDays);
    const maxDateStr = localDateStr(maxDate); // dayjs ile aynı timezone
    if (dateStr < todayStrVal) {
      return {
        result: {
          ok: false,
          error: "Geçmiş bir tarih için randevu alınamaz.",
        },
      };
    }
    if (dateStr > maxDateStr) {
      return {
        result: {
          ok: false,
          error: `En fazla ${advanceDays} gün sonrasına randevu alabilirsiniz.`,
        },
      };
    }
    const customerName = (args.customer_name as string) ||
      (state?.extracted as { customer_name?: string })?.customer_name || "";
    const serviceSlug =
      (args.service_slug as string | undefined)?.trim() ||
      ((args.extra_data as Record<string, unknown> | undefined)?.service_slug as string | undefined)?.trim() ||
      "";

    if (!serviceSlug) {
      return {
        result: {
          ok: false,
          error:
            "Hizmet seçilmeden randevu alınamaz. Önce match_service ile hizmeti eşleştirin veya müşteriye 'Hangi hizmet için randevu alalım?' diye sorun.",
        },
      };
    }
    const staffId = (args.staff_id as string | undefined)?.trim() || undefined;
    const hasPackageDecision = typeof args.use_package === "boolean";
    const usePackage = args.use_package === true;
    const availablePackage =
      serviceSlug ? await checkCustomerPackage(tenantId, customerPhone, serviceSlug) : null;

    if (serviceSlug && availablePackage && !hasPackageDecision) {
      return {
        result: {
          ok: false,
          error: "ACTIVE_PACKAGE_CONFIRMATION_REQUIRED",
          package_name: availablePackage.packageName,
          remaining_sessions: availablePackage.remainingSessions,
        },
      };
    }

    if (usePackage && serviceSlug && !availablePackage) {
      return {
        result: {
          ok: false,
          error: "Bu hizmet için aktif paket bulunamadı veya seans hakkı kalmadı.",
        },
      };
    }

    const packageCandidate = usePackage ? availablePackage : null;

    const extraData = {
      ...(args.extra_data as Record<string, unknown> || {}),
      ...(customerName ? { customer_name: customerName } : {}),
      ...(staffId ? { preferred_staff_id: staffId } : {}),
      ...(usePackage && packageCandidate
        ? {
            package_usage: {
              customer_package_id: packageCandidate.customerPackageId,
              package_id: packageCandidate.packageId,
              package_name: packageCandidate.packageName,
              used_session: 1,
            },
          }
        : {}),
    };
    let result: { ok: boolean; id?: string; error?: string; suggested_time?: string };
    try {
      const reserveResult = await withRetry(() =>
        reserveAppointment({
        tenantId,
        customerPhone,
        date: dateStr,
        time: timeStr,
        staffId,
        serviceSlug,
        extraData,
      })
      );
      if (!reserveResult.ok) {
        result = {
          ok: false,
          error: reserveResult.error,
          suggested_time: reserveResult.suggested_time,
        };
      } else {
        result = { ok: true, id: reserveResult.id };
      }
    } catch (err) {
      console.error("[ai] createAppointment:", err);
      result = { ok: false, error: "Bir hata oluştu." };
    }
    if (result.ok) {
      let packageUsageResult:
        | {
            used: boolean;
            remainingSessions?: number;
            status?: string;
            error?: string;
          }
        | undefined;

      if (usePackage && packageCandidate) {
        const consumed = await consumeCustomerPackageSession(
          packageCandidate.customerPackageId
        );
        packageUsageResult = consumed.ok
          ? {
              used: true,
              remainingSessions: consumed.remainingSessions,
              status: consumed.status,
            }
          : {
              used: false,
              error: consumed.error || "PACKAGE_CONSUME_FAILED",
            };
      }

      notifyNewAppointmentForMerchant({
        tenantId,
        customerPhone,
        date: dateStr,
        time: timeStr,
        staffId: staffId || null,
        source: "bot",
      }).catch((e) => console.error("[ai] merchant notify error:", e));
      checkAndNotifyWaitlist(tenantId, dateStr, configOverride).catch((e) =>
        console.error("[ai] waitlist notify error:", e)
      );
      return {
        result: {
          ok: true,
          date: dateStr,
          date_readable: formatDateReadableTr(dateStr, timeStr),
          time: timeStr,
          customer_name: customerName,
          ...(packageUsageResult
            ? {
                package_used: packageUsageResult.used,
                package_remaining_sessions: packageUsageResult.remainingSessions,
                package_status: packageUsageResult.status,
                package_error: packageUsageResult.error,
              }
            : {}),
        },
        sessionUpdate: {
          extracted: {
            ...(state?.extracted || {}),
            customer_name: customerName,
          },
        },
      };
    }
    return {
      result: {
        ok: false,
        error: result.error,
        suggested_time: result.suggested_time,
      },
    };
  }

  if (name === "check_customer_package") {
    const serviceSlug = (args.service_slug as string | undefined)?.trim();
    if (!serviceSlug) {
      return {
        result: {
          ok: false,
          has_package: false,
          error: "service_slug gerekli",
        },
      };
    }

    const customerPackage = await checkCustomerPackage(
      tenantId,
      customerPhone,
      serviceSlug
    );

    if (!customerPackage) {
      return {
        result: {
          ok: true,
          has_package: false,
          service_slug: serviceSlug,
        },
      };
    }

    return {
      result: {
        ok: true,
        has_package: true,
        service_slug: customerPackage.serviceSlug,
        package_id: customerPackage.packageId,
        customer_package_id: customerPackage.customerPackageId,
        package_name: customerPackage.packageName,
        remaining_sessions: customerPackage.remainingSessions,
        total_sessions: customerPackage.totalSessions,
        expires_at: customerPackage.expiresAt,
      },
    };
  }

  if (name === "get_last_appointment") {
    const last = await getCustomerLastActiveAppointment(
      tenantId,
      customerPhone
    );
    if (last) {
      const slotDateTime = formatSlotDateTimeTr(last.slot_start);
      const dateStr = slotDateTime.date || "-";
      const timeStr = slotDateTime.time || "-";
      return {
        result: {
          found: true,
          appointment_id: last.id,
          date: dateStr,
          time: timeStr,
        },
        sessionUpdate: {
          step: "iptal_onay_bekleniyor",
          extracted: {
            ...(state?.extracted || {}),
            pending_cancel_appointment_id: last.id,
          },
        },
      };
    }
    return { result: { found: false } };
  }

  if (name === "cancel_appointment") {
    if (!isCancelConfirmation(lastUserMessage)) {
      return {
        result: {
          ok: false,
          error: "İptal işlemi için müşteriden açık onay alınmalı (örn: \"evet iptal\").",
        },
      };
    }
    const aptId =
      (args.appointment_id as string) ||
      (state?.extracted as { pending_cancel_appointment_id?: string })
        ?.pending_cancel_appointment_id;
    if (!aptId) {
      return { result: { ok: false, error: "Randevu bulunamadı" } };
    }
    const cancellationHrs = mergedConfig?.cancellation_hours ?? (configOverride?.cancellation_hours as number) ?? 2;
    const hasCancellationRule = mergedConfig != null || (configOverride?.cancellation_hours != null);
    const { data: apt } = await supabase
      .from("appointments")
      .select("id, slot_start")
      .eq("id", aptId)
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();
    if (!apt) {
      return {
        result: {
          ok: false,
          error: "Bu randevu için iptal yetkiniz yok veya randevu aktif değil.",
        },
      };
    }
    if (hasCancellationRule && !apt?.slot_start) {
      return {
        result: {
          ok: false,
          error: "Randevu bilgisi alınamadı, iptal işlemi yapılamıyor.",
        },
      };
    }
    if (apt?.slot_start) {
      const slotTime = new Date(apt.slot_start).getTime();
      const now = Date.now();
      const hoursLeft = (slotTime - now) / (60 * 60 * 1000);
      if (hoursLeft < cancellationHrs) {
        return {
          result: {
            ok: false,
            error: `İptal için randevu saatine en az ${cancellationHrs} saat kala iptal edebilirsiniz.`,
          },
        };
      }
    }
    const cancelResult = await cancelAppointment({
      tenantId,
      appointmentId: aptId,
      cancelledBy: "customer",
      reason: args.reason as string,
    });
    if (cancelResult.ok) {
      // İptal sonrası bekleme listesini bilgilendir
      const aptDate = await getAppointmentDate(aptId);
      if (aptDate) {
        checkAndNotifyWaitlist(tenantId, aptDate, configOverride).catch((e) =>
          console.error("[ai] waitlist notify after cancel:", e)
        );
      }
      return { result: { ok: true }, sessionDeleted: true };
    }
    return { result: { ok: false, error: cancelResult.error } };
  }

  if (name === "check_week_availability") {
    const startDate = args.start_date as string;
    const weekResults: Record<string, string[]> = {};
    const closedDays: string[] = [];
    const parts = startDate.split("-").map(Number);
    if (parts.length !== 3) {
      return { result: { days: {}, message: "Geçersiz tarih formatı" } };
    }
    const [y, m, day] = parts;
    const todayStr = localDateStr(new Date());
    const advanceDays =
      mergedConfig?.advance_booking_days ??
      (configOverride?.advance_booking_days as number) ??
      14;
    for (let i = 0; i < advanceDays; i++) {
      const d = new Date(y, m - 1, day + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (ds < todayStr) continue;
      const daily = await getDailyAvailability(tenantId, ds, {
        configOverride,
        customerPhone,
      });
      const avail = {
        available: daily.available,
        booked: daily.booked,
        blocked: daily.blocked,
        closed: daily.closed,
        noSchedule: daily.noSchedule,
      };
      if (avail.blocked) continue;
      if (avail.closed) { closedDays.push(ds); continue; }
      if (avail.available.length > 0) {
        weekResults[`${ds} (${formatDateTr(ds)})`] = avail.available;
      }
    }
    if (Object.keys(weekResults).length > 0) {
      return { result: { days: weekResults } };
    }
    return {
      result: {
        days: {},
        message: `Önümüzdeki ${advanceDays} gün içinde müsait gün bulunamadı.`,
        closed_day_count: closedDays.length,
      },
    };
  }

  if (name === "reschedule_appointment") {
    const aptId =
      (args.appointment_id as string) ||
      (state?.extracted as { pending_cancel_appointment_id?: string })
        ?.pending_cancel_appointment_id;
    if (!aptId) {
      return { result: { ok: false, error: "Randevu bulunamadı" } };
    }
    const { data: currentApt } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", aptId)
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();
    if (!currentApt) {
      return {
        result: {
          ok: false,
          error: "Bu randevu için değiştirme yetkiniz yok veya randevu aktif değil.",
        },
      };
    }

    const newDate = args.new_date as string;
    const newTime = args.new_time as string;
    const todayReschedule = localDateStr(new Date());
    if (newDate < todayReschedule) {
      return {
        result: {
          ok: false,
          error: "Geçmiş bir tarih için randevu alınamaz.",
        },
      };
    }
    const advanceDaysReschedule = mergedConfig?.advance_booking_days ?? (configOverride?.advance_booking_days as number) ?? 30;
    const maxDateReschedule = new Date();
    maxDateReschedule.setDate(maxDateReschedule.getDate() + advanceDaysReschedule);
    if (newDate > localDateStr(maxDateReschedule)) {
      return {
        result: {
          ok: false,
          error: `En fazla ${advanceDaysReschedule} gün sonrasına randevu alabilirsiniz.`,
        },
      };
    }
    let createRes: { ok: boolean; id?: string; error?: string; suggested_time?: string };
    try {
      const reserveResult = await reserveAppointment({
        tenantId,
        customerPhone,
        date: newDate,
        time: newTime,
      });
      if (!reserveResult.ok) {
        createRes = {
          ok: false,
          error: reserveResult.error,
          suggested_time: reserveResult.suggested_time,
        };
      } else {
        createRes = { ok: true, id: reserveResult.id };
      }
    } catch (err) {
      console.error("[ai] createAppointment:", err);
      createRes = { ok: false, error: "Bir hata oluştu." };
    }
    if (!createRes.ok) {
      return {
        result: {
          ok: false,
          error: createRes.error || "Yeni randevu oluşturulamadı",
          suggested_time: createRes.suggested_time,
        },
      };
    }

    const cancelRes = await cancelAppointment({
      tenantId,
      appointmentId: aptId,
      cancelledBy: "customer",
      reason: "Yeniden planlama",
    });
    if (!cancelRes.ok) {
      if (createRes.id) {
        await supabase
          .from("appointments")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: "tenant",
            cancellation_reason: "Reschedule rollback",
          })
          .eq("id", createRes.id)
          .eq("tenant_id", tenantId);
      }
      return {
        result: {
          ok: false,
          error: "Randevu değiştirilemedi, mevcut randevunuz korunuyor.",
        },
      };
    }

    let rescheduledStaffId: string | null = null;
    if (createRes.id) {
      const { data: rescheduledApt } = await supabase
        .from("appointments")
        .select("staff_id")
        .eq("id", createRes.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      rescheduledStaffId = (rescheduledApt?.staff_id as string | null | undefined) || null;
    }

    notifyRescheduledAppointmentForMerchant({
      tenantId,
      customerPhone,
      newDate,
      newTime,
      staffId: rescheduledStaffId,
      source: "bot",
    }).catch((e) => console.error("[ai] merchant reschedule notify error:", e));
    return {
      result: {
        ok: true,
        old_cancelled: true,
        new_date: newDate,
        new_date_readable: formatDateReadableTr(newDate, newTime),
        new_time: newTime,
      },
      sessionDeleted: true,
    };
  }

  if (name === "create_recurring") {
    const dow = args.day_of_week as number;
    const time = args.time as string;
    const res = await createRecurringAppointment(tenantId, customerPhone, dow, time);
    if (res.ok) {
      return {
        result: {
          ok: true,
          day: dayOfWeekToTurkish(dow),
          time,
        },
      };
    }
    return { result: { ok: false, error: res.error } };
  }

  if (name === "add_to_waitlist") {
    const date = args.date as string;
    const preferredTime = args.preferred_time as string | undefined;
    const res = await addToWaitlist(tenantId, customerPhone, date, preferredTime);
    if (res.ok) {
      return {
        result: {
          ok: true,
          date,
          date_readable: formatDateTr(date),
        },
      };
    }
    return { result: { ok: false, error: res.error } };
  }

  if (name === "get_services") {
    const [serviceRes, tenantRes] = await Promise.all([
      supabase
        .from("services")
        .select("name, slug, price, description, price_visible, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase.from("tenants").select("contact_phone").eq("id", tenantId).single(),
    ]);

    let services = serviceRes.data as
      | Array<{
          name: string;
          slug: string;
          price: number | null;
          description: string | null;
          price_visible?: boolean | null;
        }>
      | null;
    if (serviceRes.error) {
      const legacyRes = await supabase
        .from("services")
        .select("name, slug, price, description")
        .eq("tenant_id", tenantId);
      services = (legacyRes.data as typeof services) || null;
    }
    const tenantInfo = tenantRes.data;
    const fallbackPhone = tenantInfo?.contact_phone || "işletme telefonu";

    if (!services || services.length === 0) {
      return {
        result: {
          services: [],
          message: `Şu an listede hizmet görünmüyor. Detay için ${fallbackPhone} numarasından bizi arayabilirsin.`,
        },
      };
    }
    return {
      result: {
        services: services.map((s) => ({
          name: s.name,
          price:
            s.price_visible === false || s.price == null
              ? `Fiyat için arayın: ${fallbackPhone}`
              : `${s.price} TL`,
          price_visible: s.price_visible !== false,
          description: s.description || "",
        })),
        fallback_phone: fallbackPhone,
      },
    };
  }

  if (name === "get_tenant_info") {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, contact_phone, working_hours_text, config_override")
      .eq("id", tenantId)
      .single();
    if (!tenant) return { result: { error: "İşletme bulunamadı" } };
    const cfg = (tenant.config_override || {}) as Record<string, unknown>;
    return {
      result: {
        name: tenant.name,
        phone: tenant.contact_phone || "Belirtilmemiş",
        working_hours: tenant.working_hours_text || "Belirtilmemiş",
        address: (cfg.address as string) || "Belirtilmemiş",
        maps_url: (cfg.maps_url as string) || null,
      },
    };
  }

  if (name === "notify_late") {
    const minutes = args.minutes as number;
    const msg = args.message as string | undefined;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("contact_phone, name")
      .eq("id", tenantId)
      .single();
    if (!tenant?.contact_phone) {
      return { result: { ok: false, error: "İşletme iletişim numarası yok" } };
    }
    const lateMsg = `${customerPhone} müşteriniz ${minutes} dakika geç kalacağını bildirdi.${msg ? ` Mesaj: ${msg}` : ""}`;
    await sendWhatsAppMessage({ to: tenant.contact_phone, text: lateMsg });
    await createOpsAlert({
      tenantId,
      type: "delay",
      severity: minutes >= 20 ? "high" : "medium",
      customerPhone,
      message: `${customerPhone} müşterisi ${minutes} dk gecikecek.`,
      meta: { minutes, source: "tool", note: msg || null },
      dedupeKey: `delay:${tenantId}:${customerPhone.replace(/\D/g, "")}:${new Date()
        .toISOString()
        .slice(0, 13)}`,
    }).catch((e) => console.error("[ai] ops alert create error:", e));
    return { result: { ok: true, notified: true } };
  }

  return { result: { error: "Bilinmeyen fonksiyon" } };
}
