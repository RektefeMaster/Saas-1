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
  listCustomerActivePackages,
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


/**
 * Modelin gönderdiği personel değerini GERÇEK bir staff.id'ye çevirir.
 *
 * Botun personel kimliklerini öğrenebileceği bir aracı yok; "PERSONEL: staff_id
 * gönder" kuralı gereği model adı slug'layıp uyduruyordu ("Ahmet Usta" →
 * "ahmet-usta"). Bu değer doğrulanmadan randevuya yazılıyor, personel tercihi
 * sessizce kayboluyor ve takvim tutarsız hale geliyordu.
 * Burada hem id hem AD kabul edilir; eşleşme yoksa null döner (otomatik atama).
 */
async function resolveStaffId(
  tenantId: string,
  raw: string | undefined
): Promise<string | undefined> {
  const value = (raw || "").trim();
  if (!value) return undefined;

  const { data } = await supabase
    .from("staff")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const rows = (data || []) as Array<{ id: string; name: string }>;
  if (rows.length === 0) return undefined;

  if (rows.some((r) => r.id === value)) return value;

  const norm = (v: string) =>
    v
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const target = norm(value);
  const exact = rows.find((r) => norm(r.name) === target);
  if (exact) return exact.id;

  // "ahmet-usta" ↔ "Ahmet Usta" veya sadece "Ahmet" gibi kısmi eşleşmeler.
  const partial = rows.find((r) => {
    const n = norm(r.name);
    return n.includes(target) || target.includes(n) ||
      n.split(" ").some((w) => w.length > 2 && target.includes(w));
  });
  return partial?.id;
}


/**
 * Müşterinin serbest metninde geçen personel adını bulur.
 * Model `staff_id` göndermeyi atlasa bile "Ahmet Usta ile alabilir miyim?"
 * talebi karşılıksız kalmasın diye son çare olarak kullanılır.
 */
async function resolveStaffFromText(
  tenantId: string,
  text: string | undefined
): Promise<string | undefined> {
  const raw = (text || "").trim();
  if (raw.length < 3) return undefined;

  const { data } = await supabase
    .from("staff")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const rows = (data || []) as Array<{ id: string; name: string }>;
  if (rows.length === 0) return undefined;

  const norm = (v: string) =>
    v
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const haystack = norm(raw);
  // Unvan/genel kelimeler tek başına ayırt edici değil; adın kendisi aranır.
  const GENERIC = new Set(["dr", "uzman", "usta", "vet", "hekim", "bey", "hanim"]);
  for (const row of rows) {
    const parts = norm(row.name).split(" ").filter((w) => w.length > 2 && !GENERIC.has(w));
    if (parts.length && parts.every((w) => haystack.includes(w))) return row.id;
  }
  return undefined;
}


/**
 * Son birkaç müşteri mesajını birleştirir.
 * Personel adı çoğu zaman ONAY turundan ÖNCEKİ mesajda geçiyor
 * ("... Dr. Selin ile ..." → "evet oluştur"); yalnızca son mesaja bakmak
 * tercihi kaçırıyordu.
 */
function recentUserText(state: ConversationState | null, lastUserMessage: string): string {
  const history = (state?.chat_history || [])
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content);
  return [...history, lastUserMessage].join(" \n ");
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
    // Personel tercihi konuşma boyunca TAŞINIR. Canlı testte model müsaitliği
    // "Dr. Selin için" sorup randevuyu personelsiz açıyordu; müşteri istediği
    // uzmanı aldığını sanıyor, takvimde başka birine düşüyordu.
    const staffId = await resolveStaffId(tenantId, args.staff_id as string | undefined);
    const daily = await getDailyAvailability(tenantId, dateStr, {
      configOverride,
      staffId,
      serviceSlug,
      customerPhone,
    });
    const staffPreferenceUpdate = staffId
      ? {
          sessionUpdate: {
            extracted: { ...getStateExtracted(state), preferred_staff_id: staffId },
          },
        }
      : {};
    if (daily.checkFailed) {
      return {
        result: {
          date: dateStr,
          date_readable: formatDateTr(dateStr),
          status: "availability_check_failed",
          available: [],
          booked_count: 0,
        },
        ...staffPreferenceUpdate,
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
    else if (availability.available.length === 0)
      // Gün boş ama saat geçmişse "dolu" DEME; müşteri haklı olarak itiraz ediyor.
      status = daily.pastCutoff ? "too_late_today" : "fully_booked";
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
        ...(status === "too_late_today"
          ? {
              status_note: `Bugün takvim DOLU DEĞİL; çalışma saati (${daily.workingHours?.end || "kapanış"}) içinde ${daily.durationMinutes} dakikalık işleme yetecek süre kalmadı. Müşteriye "dolu" deme, "bugüne yetişmiyor" de ve en yakın günü öner.`,
            }
          : {}),
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
          ...(staffId ? { preferred_staff_id: staffId } : {}),
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
    // Personel tercihi ÜÇ kaynaktan aranır. Model tercihi düzenli olarak
    // düşürüyordu: müsaitliği "Dr. Selin için" sorup randevuyu personelsiz
    // açıyor, müşteri istediği uzmanı aldığını sanıyordu.
    //   1) aracın kendi argümanı
    //   2) oturumda taşınan tercih (check_availability'den)
    //   3) müşterinin mesajında geçen personel adı
    const staffId =
      (await resolveStaffId(tenantId, args.staff_id as string | undefined)) ??
      (await resolveStaffId(
        tenantId,
        (getStateExtracted(state).preferred_staff_id as string | undefined) || undefined
      )) ??
      (await resolveStaffFromText(tenantId, recentUserText(state, lastUserMessage)));
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
      existing_appointment_id?: string;
      existing_time?: string;
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
          existing_appointment_id: reserveResult.existing_appointment_id,
          existing_time: reserveResult.existing_time,
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
            // Hemen ardından gelen "aslında 16:00 olsun" talebinin DOĞRU
            // randevuyu taşıyabilmesi için oluşturulan kaydın ID'si saklanır.
            last_appointment_id: result.id,
          },
        },
      };
    }
    if (result.error === "ALREADY_BOOKED_SAME_DAY") {
      // Model ikinci randevu açmak yerine mevcut olanı TAŞIMALI.
      return {
        result: {
          ok: false,
          error: "ALREADY_BOOKED_SAME_DAY",
          existing_appointment_id: result.existing_appointment_id,
          existing_time: result.existing_time,
          hint:
            "Bu müşterinin o gün aynı hizmet için zaten aktif randevusu var. Yeni randevu AÇMA; " +
            "saat değişikliği isteniyorsa reschedule_appointment kullan. Başka bir KİŞİ için " +
            "randevu alınıyorsa customer_name alanına o kişinin adını yaz.",
        },
        sessionUpdate: {
          extracted: {
            ...getStateExtracted(state),
            last_appointment_id: result.existing_appointment_id,
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
    // Hizmet belirtilmediyse müşterinin TÜM aktif paketlerini döndür:
    // "paketimde kaç seans kaldı?" sorusunda hizmet adı gelmiyor.
    if (!serviceSlug) {
      const allPackages = await listCustomerActivePackages(tenantId, customerPhone);
      return {
        result: {
          ok: true,
          has_package: allPackages.length > 0,
          packages: allPackages.map((pk) => ({
            package_name: pk.packageName,
            service_slug: pk.serviceSlug,
            remaining_sessions: pk.remainingSessions,
            total_sessions: pk.totalSessions,
            expires_at: pk.expiresAt,
          })),
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
      // Bot sohbetinden iptal: ayrı bildirim gönderilmesin, cevap zaten onay.
      source: "bot",
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
    // ID çözümleme sırası. Eskiden yalnızca iptal akışında set edilen
    // pending_cancel_appointment_id'ye bakılıyordu; "aslında 16:00 olsun" gibi
    // normal erteleme taleplerinde ID hiç bulunamıyor ve erteleme başarısız
    // oluyordu (bot da çareyi ikinci bir randevu açmakta buluyordu).
    // Son çare aramada tenant + müşteri telefonu ile sınırlıdır.
    const ext = (state?.extracted || {}) as {
      last_appointment_id?: string;
      pending_cancel_appointment_id?: string;
    };
    const aptId =
      (args.appointment_id as string) ||
      ext.last_appointment_id ||
      ext.pending_cancel_appointment_id ||
      (await getCustomerLastActiveAppointment(tenantId, customerPhone))?.id;
    if (!aptId) {
      return { result: { ok: false, error: "Taşınacak aktif randevu bulunamadı" } };
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
        // Taşınan randevunun kendisi "zaten var" sayılmamalı.
        excludeAppointmentId: aptId,
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
          excludeAppointmentId: aptId,
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
      source: "bot",
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
