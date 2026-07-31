import { supabase } from "../../../supabase";
import { sendWhatsAppMessage } from "../../../whatsapp";
import {
  getAvailabilityRange,
  getDailyAvailability,
  minutesToTime,
  reserveAppointment,
  timeToMinutes,
} from "@/services/booking.service";
import { getCustomerLastActiveAppointment, cancelAppointment } from "@/services/cancellation.service";
import { getCustomerUpcomingAppointments } from "@/services/customerHistory.service";
import { addToWaitlist, notifyWaitlist } from "@/services/waitlist.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import { isCancelConfirmation, isSoftAffirmation } from "../intent-detection";
import { dayOfWeekToTurkish, formatDateTr, formatDateReadableTr } from "../helpers";
import {
  localDateStr,
  formatSlotDateTimeTr,
  getSelectedServiceFromExtracted,
} from "../context-builder";
import { todayStr } from "@/lib/dayjs-utils";
import { withRetry } from "@/lib/retry";
import type { ConversationState } from "../../../database.types";
import type { MergedConfig } from "@/types/botConfig.types";
import {
  notifyNewAppointmentForMerchant,
  notifyRescheduledAppointmentForMerchant,
} from "@/services/merchantNotification.service";
import { upsertCrmCustomer } from "@/services/crmCustomer.service";
import { markLeadConverted } from "@/services/leadMemory.service";
import { publishDomainEvent } from "@/services/domainEvents.service";
import {
  checkCustomerPackage,
  consumeCustomerPackageSession,
  listActivePackages,
} from "@/services/package.service";
import { createWeeklySeries } from "@/services/appointmentSeries.service";
import { matchServiceToSlug } from "./match-service";
import { phoneVariants } from "@/lib/phone";

export interface ToolExecResult {
  result: Record<string, unknown>;
  sessionDeleted?: boolean;
  sessionUpdate?: Partial<ConversationState>;
}

async function checkAndNotifyWaitlist(tenantId: string, dateStr: string): Promise<void> {
  // Müsaitlik artık bekleyenin KENDİ hizmetine göre notifyWaitlist içinde
  // hesaplanıyor; burada sadece işletme adını geçmek yeterli.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  await notifyWaitlist(tenantId, dateStr, tenant?.name || "İşletme");
}

async function getAppointmentDateAndService(
  appointmentId: string
): Promise<{ date: string; serviceSlug: string | null } | null> {
  const { data } = await supabase
    .from("appointments")
    .select("slot_start, service_slug")
    .eq("id", appointmentId)
    .single();
  if (!data) return null;
  const parsed = new Date(data.slot_start);
  if (isNaN(parsed.getTime())) return null;
  return {
    date: localDateStr(parsed),
    serviceSlug: (data.service_slug as string | null) || null,
  };
}

function getStateExtracted(state: ConversationState | null): Record<string, unknown> {
  return (state?.extracted || {}) as Record<string, unknown>;
}

function resolveSelectedServiceSlug(
  args: Record<string, unknown>,
  state: ConversationState | null
): string | undefined {
  const extracted = getStateExtracted(state);
  const fromArgs =
    (args.service_slug as string | undefined)?.trim() ||
    ((args.extra_data as Record<string, unknown> | undefined)?.service_slug as string | undefined)?.trim();
  const fromState = getSelectedServiceFromExtracted(extracted).slug;
  return fromArgs || fromState || undefined;
}

function mergeSelectedService(
  state: ConversationState | null,
  serviceSlug?: string,
  serviceName?: string
): Record<string, unknown> {
  const extracted = getStateExtracted(state);
  if (!serviceSlug) return extracted;
  return {
    ...extracted,
    selected_service_slug: serviceSlug,
    ...(serviceName ? { selected_service_name: serviceName } : {}),
  };
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
    const serviceSlug = resolveSelectedServiceSlug(args, state);
    const staffId = (args.staff_id as string | undefined)?.trim() || undefined;
    const daily = await getDailyAvailability(tenantId, dateStr, {
      configOverride,
      staffId,
      serviceSlug,
      customerPhone,
    });
    if (daily.checkFailed) {
      return {
        result: {
          date: dateStr,
          date_readable: formatDateTr(dateStr),
          status: "availability_check_failed",
          available: [],
          booked_count: 0,
        },
      };
    }
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

    // O gün dolu görünen saatlerin hangileri MÜŞTERİNİN KENDİ randevusu?
    // Bu bilgi olmadan bot kendi az önce oluşturduğu randevuyu "başkasının
    // randevusu" diye anlatıyordu.
    const ownSlots = (
      await getCustomerUpcomingAppointments(tenantId, customerPhone, 10).catch(() => [])
    )
      .filter((apt) => apt.date === dateStr)
      .map((apt) => apt.time);

    return {
      result: {
        date: dateStr,
        date_readable: formatDateTr(dateStr),
        status,
        available: availability.available,
        booked_count: availability.booked.length,
        // Listelenen saatler bu süreye göre süzüldü. Bot "15:00 uygun, işlem
        // 17:30'da biter" diyebilsin ve süreyi uydurmasın.
        service_duration_minutes: daily.durationMinutes,
        duration_note: `Listedeki her saat ${daily.durationMinutes} dakikalık işlem için uygundur; bu süre boyunca takvim kapanır.`,
        ...(ownSlots.length > 0
          ? {
              your_appointment_times: ownSlots,
              your_appointment_note:
                "Bu saatler müşterinin KENDİ randevusu. Dolu diye geçiştirme; 'orası sizin randevunuz' de.",
            }
          : {}),
      },
      sessionUpdate: {
        step: "saat_secimi_bekleniyor",
        extracted: {
          ...mergeSelectedService(state, serviceSlug),
          last_availability_date: dateStr,
          last_available_slots: availability.available,
        },
      },
    };
  }

  if (name === "match_service") {
    const userText = (args.user_text as string)?.trim() ?? "";
    const matchResult = await matchServiceToSlug(tenantId, userText);
    if (matchResult.ok) {
      return {
        result: matchResult as unknown as Record<string, unknown>,
        sessionUpdate: {
          step: "tarih_saat_bekleniyor",
          extracted: mergeSelectedService(
            state,
            matchResult.service_slug,
            matchResult.service_name
          ),
        },
      };
    }
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
    const serviceSlug = resolveSelectedServiceSlug(args, state) || "";

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
    let result: {
      ok: boolean;
      id?: string;
      error?: string;
      suggested_time?: string;
      duration_minutes?: number;
    };
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
        result = {
          ok: true,
          id: reserveResult.id,
          duration_minutes: reserveResult.duration_minutes,
        };
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
      // Waitlist notify only on cancel (slot freed), not on create.
      const customerId = await upsertCrmCustomer(tenantId, customerPhone, customerName);
      // Randevu alan lead artık müşteri.
      void markLeadConverted(tenantId, customerPhone).catch((e) =>
        console.warn("[ai] lead convert:", e)
      );
      if (customerId) {
        void publishDomainEvent({
          tenantId,
          eventType: "APPOINTMENT_CREATED",
          aggregateType: "crm_customer",
          aggregateId: customerId,
          idempotencyKey: `appt_created:${tenantId}:${customerId}:${dateStr}:${timeStr}`,
          payload: {
            customerId,
            customerPhone,
            dateSelected: true,
            nameProvided: Boolean(customerName),
          },
        }).catch(() => undefined);
      }
      const endTime = result.duration_minutes
        ? minutesToTime(timeToMinutes(timeStr) + result.duration_minutes)
        : null;
      return {
        result: {
          ok: true,
          date: dateStr,
          date_readable: formatDateReadableTr(dateStr, timeStr),
          time: timeStr,
          customer_name: customerName,
          ...(result.duration_minutes
            ? { duration_minutes: result.duration_minutes, end_time: endTime }
            : {}),
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
            ...mergeSelectedService(state, serviceSlug),
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
        // DİKKAT: Burada pending_cancel_appointment_id SET EDİLMEZ.
        // Bu tool "randevum ne zamandı?" gibi masum sorularda da çağrılıyor;
        // bayrağı burada set etmek müşteriyi iptal onayı moduna sokup sonraki
        // "tamam"/"evet" mesajında randevunun silinmesine yol açıyordu.
        // İptal beklemesi yalnızca açık iptal talebinde (processor) başlatılır.
        sessionUpdate: {
          extracted: {
            ...(state?.extracted || {}),
            last_appointment_id: last.id,
          },
        },
      };
    }
    return { result: { found: false } };
  }

  if (name === "cancel_appointment") {
    // Kısa onay ("evet"/"tamam") yalnızca açık iptal talebiyle başlatılmış bir
    // onay beklemesinde geçerli; aksi halde açık onay kalıbı şart.
    const cancelPending = Boolean(
      (state?.extracted as { pending_cancel_appointment_id?: string })
        ?.pending_cancel_appointment_id
    );
    const cancelConfirmed =
      isCancelConfirmation(lastUserMessage) ||
      (cancelPending && isSoftAffirmation(lastUserMessage));
    if (!cancelConfirmed) {
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
      // Panelden farklı formatta girilmiş numaralar da eşleşsin (+90 / 90 / 0…).
      .in("customer_phone", phoneVariants(customerPhone))
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
      customerPhone,
      reason: args.reason as string,
    });
    if (cancelResult.ok) {
      // İptal sonrası bekleme listesini bilgilendir. Boşalan blok iptal edilen
      // randevunun hizmet süresiyle değerlendirilir.
      const cancelled = await getAppointmentDateAndService(aptId);
      if (cancelled) {
        checkAndNotifyWaitlist(tenantId, cancelled.date).catch((e) =>
          console.error("[ai] waitlist notify after cancel:", e)
        );
      }
      const customerId = await upsertCrmCustomer(tenantId, customerPhone);
      if (customerId) {
        void publishDomainEvent({
          tenantId,
          eventType: "APPOINTMENT_CANCELLED",
          aggregateType: "crm_customer",
          aggregateId: customerId,
          idempotencyKey: `appt_cancel:${tenantId}:${customerId}:${aptId}`,
          payload: { customerId, customerPhone, appointmentId: aptId },
        }).catch(() => undefined);
      }
      return { result: { ok: true }, sessionDeleted: true };
    }
    return { result: { ok: false, error: cancelResult.error } };
  }

  if (name === "check_week_availability") {
    const startDate = args.start_date as string;
    // Seçili hizmet geçilmezse haftalık tarama TAKVİM ADIMIYLA (30 dk) hesaplanıp
    // 2,5 saatlik bir işleme sığmayan saatleri "boş" gösteriyordu.
    const weekServiceSlug = resolveSelectedServiceSlug(args, state);
    const range = await getAvailabilityRange(tenantId, startDate, {
      configOverride,
      customerPhone,
      serviceSlug: weekServiceSlug,
      maxDays: 7,
    });
    const labeled: Record<string, string[]> = {};
    for (const [ds, slots] of Object.entries(range.days)) {
      labeled[`${ds} (${formatDateTr(ds)})`] = slots;
    }
    if (Object.keys(labeled).length > 0) {
      return { result: { days: labeled } };
    }
    return {
      result: {
        days: {},
        message: range.message || "Önümüzdeki 7 gün içinde müsait gün bulunamadı.",
        closed_day_count: range.closedDays.length,
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
      .select("id, service_slug, staff_id, extra_data")
      .eq("id", aptId)
      .eq("tenant_id", tenantId)
      .in("customer_phone", phoneVariants(customerPhone))
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
    // Eski randevunun hizmeti/adı/personeli taşınır. Aksi halde yeni randevu
    // hizmetsiz ve isimsiz oluşuyor, süre de varsayılan slota düşüyordu.
    const previousExtra =
      (currentApt.extra_data as Record<string, unknown> | null) || {};
    const carriedServiceSlug =
      (currentApt.service_slug as string | null) ||
      resolveSelectedServiceSlug(args, state) ||
      null;
    const carriedStaffId = (currentApt.staff_id as string | null) || null;
    const carriedExtraData: Record<string, unknown> = { ...previousExtra };
    delete carriedExtraData.duration_minutes; // yeni hizmet süresine göre baştan hesaplanır
    const carriedName =
      (previousExtra.customer_name as string | undefined) ||
      ((state?.extracted as { customer_name?: string })?.customer_name ?? undefined);
    if (carriedName) carriedExtraData.customer_name = carriedName;

    let createRes: { ok: boolean; id?: string; error?: string; suggested_time?: string };
    try {
      let reserveResult = await reserveAppointment({
        tenantId,
        customerPhone,
        date: newDate,
        time: newTime,
        staffId: carriedStaffId,
        serviceSlug: carriedServiceSlug,
        extraData: carriedExtraData,
      });
      // Aynı personel yeni saatte doluysa havuzdan başka personelle dene.
      if (!reserveResult.ok && reserveResult.error === "SLOT_TAKEN" && carriedStaffId) {
        reserveResult = await reserveAppointment({
          tenantId,
          customerPhone,
          date: newDate,
          time: newTime,
          serviceSlug: carriedServiceSlug,
          extraData: carriedExtraData,
        });
      }
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
      customerPhone,
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
    const serviceSlug = resolveSelectedServiceSlug(args, state);
    if (!serviceSlug) {
      return {
        result: {
          ok: false,
          error:
            "Seri randevu için önce hizmet belirlenmeli. match_service ile hizmeti eşleştirin.",
        },
      };
    }
    const customerName =
      (args.customer_name as string | undefined)?.trim() ||
      ((state?.extracted as { customer_name?: string })?.customer_name ?? "").trim();
    if (!customerName) {
      return {
        result: { ok: false, error: "Seri randevu için müşterinin adı gerekli." },
      };
    }

    const series = await createWeeklySeries({
      tenantId,
      customerPhone,
      dayOfWeek: args.day_of_week as number,
      time: args.time as string,
      serviceSlug,
      customerName,
      occurrences: args.occurrences as number | undefined,
      advanceBookingDays:
        mergedConfig?.advance_booking_days ??
        (configOverride?.advance_booking_days as number) ??
        30,
      today: todayStr(),
    });

    if (series.created.length === 0) {
      return {
        result: {
          ok: false,
          error: "Seri oluşturulamadı; istenen saatte uygun hafta bulunamadı.",
          skipped: series.skipped,
        },
      };
    }

    // İlk randevu için işletmeye tek bildirim; her hafta için ayrı ayrı spam yapılmaz.
    const first = series.created[0];
    notifyNewAppointmentForMerchant({
      tenantId,
      customerPhone,
      date: first.date,
      time: first.time,
      staffId: null,
      source: "bot",
    }).catch((e) => console.error("[ai] merchant notify (series):", e));
    await upsertCrmCustomer(tenantId, customerPhone, customerName);
    void markLeadConverted(tenantId, customerPhone).catch(() => undefined);

    return {
      result: {
        ok: true,
        day: dayOfWeekToTurkish(args.day_of_week as number),
        time: args.time,
        created_count: series.created.length,
        created: series.created.map((o) => ({
          date: o.date,
          date_readable: formatDateTr(o.date),
        })),
        skipped: series.skipped.map((s) => ({
          date: s.date,
          date_readable: formatDateTr(s.date),
          reason: s.reason,
        })),
      },
      sessionUpdate: {
        extracted: {
          ...mergeSelectedService(state, serviceSlug),
          customer_name: customerName,
        },
      },
    };
  }

  if (name === "add_to_waitlist") {
    const date = args.date as string;
    const preferredTime = args.preferred_time as string | undefined;
    // Hangi hizmet için beklendiği kaydedilir: yer açıldığında slot o hizmetin
    // süresiyle tutulur ve yalnızca gerçekten sığan boşluk bildirilir.
    const res = await addToWaitlist(
      tenantId,
      customerPhone,
      date,
      preferredTime,
      resolveSelectedServiceSlug(args, state) || null
    );
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

  if (name === "get_packages") {
    const scopedSlug =
      (args.service_slug as string | undefined)?.trim() ||
      resolveSelectedServiceSlug({}, state) ||
      undefined;

    let packages: Awaited<ReturnType<typeof listActivePackages>> = [];
    try {
      packages = await listActivePackages(tenantId, scopedSlug || null);
      // Seçili hizmete paket yoksa tüm paketleri göster; müşteri boş cevap almasın.
      if (packages.length === 0 && scopedSlug) {
        packages = await listActivePackages(tenantId, null);
      }
    } catch (err) {
      console.error("[ai] get_packages:", err);
      return { result: { ok: false, packages: [], error: "PACKAGE_LOOKUP_FAILED" } };
    }

    if (packages.length === 0) {
      return {
        result: {
          ok: true,
          packages: [],
          message: "Tanımlı bir seans paketi yok. Tek seans randevu oluşturabilirim.",
        },
      };
    }

    return {
      result: {
        ok: true,
        packages: packages.map((pkg) => ({
          name: pkg.name,
          service: pkg.serviceName || pkg.serviceSlug,
          service_slug: pkg.serviceSlug,
          total_sessions: pkg.totalSessions,
          price: pkg.price == null ? null : `${pkg.price} TL`,
          validity_days: pkg.validityDays,
        })),
        note: "Paketi sen satma; müşteri isterse randevu oluştur ve paketin randevuda tanımlanacağını söyle.",
      },
    };
  }

  if (name === "get_services") {
    const [serviceRes, tenantRes] = await Promise.all([
      supabase
        .from("services")
        .select("name, slug, price, description, duration_minutes, price_visible, is_active")
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
          duration_minutes?: number | null;
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
        services: services.map((s) => {
          const duration = Number(s.duration_minutes ?? 0);
          return {
            name: s.name,
            slug: s.slug,
            price:
              s.price_visible === false || s.price == null
                ? `Fiyat için arayın: ${fallbackPhone}`
                : `${s.price} TL`,
            price_visible: s.price_visible !== false,
            // "Ne kadar sürer?" sorusunu bot artık uydurmadan cevaplayabilsin.
            duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : null,
            description: s.description || "",
          };
        }),
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
