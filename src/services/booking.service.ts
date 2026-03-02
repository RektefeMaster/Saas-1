import { supabase } from "@/lib/supabase";
import {
  acquireBookingSlotLock,
  clearBookingSlotHold,
  getBookingHoldsForDate,
  releaseBookingSlotLock,
  setBookingSlotHold,
} from "@/lib/redis";
import { checkBlockedDate } from "@/services/blockedDates.service";

const DEFAULT_WORKING_HOURS = { start: "09:00", end: "18:00" };
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];
const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";
const SAME_DAY_MIN_LEAD_MINUTES = Math.max(
  1,
  Number(process.env.SAME_DAY_MIN_LEAD_MINUTES || 1)
);

interface TimeInterval {
  start: number;
  end: number;
}

interface TenantScheduleContext {
  configOverride: Record<string, unknown>;
  startTime: string;
  endTime: string;
  closed: boolean;
  noSchedule: boolean;
  baseSlotMinutes: number;
}

export interface DailyAvailabilityResult {
  date: string;
  available: string[];
  booked: string[];
  blocked?: boolean;
  closed?: boolean;
  noSchedule?: boolean;
  workingHours: { start: string; end: string } | null;
  durationMinutes: number;
}

export interface ReserveAppointmentInput {
  tenantId: string;
  customerPhone: string;
  date: string;
  time: string;
  serviceSlug?: string | null;
  extraData?: Record<string, unknown>;
  holdOnly?: boolean;
  holdTtlSeconds?: number;
}

export interface ReserveAppointmentResult {
  ok: boolean;
  id?: string;
  error?: string;
  suggested_time?: string;
  hold_expires_at?: string;
  duration_minutes?: number;
}

function normalizeDateString(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parts = date.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function localDateStr(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localTimeToMinutes(date: Date, timeZone = APP_TIMEZONE): number {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
}

function getUtcSearchWindowForDate(localDate: string): { from: string; to: string } {
  const [y, m, d] = localDate.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0)).toISOString(),
    to: new Date(Date.UTC(y, m - 1, d + 2, 0, 0, 0)).toISOString(),
  };
}

function getDayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function normalizeTimeString(time: string): string | null {
  const raw = String(time).trim();
  if (/^\d{1,2}$/.test(raw)) {
    return `${raw.padStart(2, "0")}:00`;
  }
  if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
    const [h, m] = raw.split(":").map((p) => Number(p));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(value: number): string {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function getTenantScheduleContext(
  tenantId: string,
  date: string,
  configOverride?: Record<string, unknown>
): Promise<TenantScheduleContext> {
  const normalizedDate = normalizeDateString(date);
  if (!normalizedDate) {
    return {
      configOverride: configOverride || {},
      startTime: DEFAULT_WORKING_HOURS.start,
      endTime: DEFAULT_WORKING_HOURS.end,
      closed: false,
      noSchedule: true,
      baseSlotMinutes: 30,
    };
  }

  let override = configOverride || {};
  if (!configOverride) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("config_override")
      .eq("id", tenantId)
      .single();
    override = (tenant?.config_override || {}) as Record<string, unknown>;
  }

  const slotMinutes = Math.min(
    120,
    Math.max(1, Number(override?.slot_duration_minutes) || 30)
  );

  const dayOfWeek = getDayOfWeek(normalizedDate);
  const { data: slots } = await supabase
    .from("availability_slots")
    .select("day_of_week, start_time, end_time")
    .eq("tenant_id", tenantId);

  if (!slots || slots.length === 0) {
    const defaultHours = (override.default_working_hours || null) as
      | { start?: string; end?: string }
      | null;
    const startTime = defaultHours?.start || DEFAULT_WORKING_HOURS.start;
    const endTime = defaultHours?.end || DEFAULT_WORKING_HOURS.end;
    if (!DEFAULT_WORKING_DAYS.includes(dayOfWeek)) {
      return {
        configOverride: override,
        startTime,
        endTime,
        closed: true,
        noSchedule: false,
        baseSlotMinutes: slotMinutes,
      };
    }
    return {
      configOverride: override,
      startTime,
      endTime,
      closed: false,
      noSchedule: false,
      baseSlotMinutes: slotMinutes,
    };
  }

  const daySlot = slots.find((s) => s.day_of_week === dayOfWeek);
  if (!daySlot) {
    return {
      configOverride: override,
      startTime: DEFAULT_WORKING_HOURS.start,
      endTime: DEFAULT_WORKING_HOURS.end,
      closed: true,
      noSchedule: false,
      baseSlotMinutes: slotMinutes,
    };
  }

  return {
    configOverride: override,
    startTime: daySlot.start_time,
    endTime: daySlot.end_time,
    closed: false,
    noSchedule: false,
    baseSlotMinutes: slotMinutes,
  };
}

async function getServiceDurationMinutes(
  tenantId: string,
  serviceSlug: string | null | undefined,
  fallback: number
): Promise<number> {
  if (!serviceSlug) return fallback;
  const slug = serviceSlug.trim();
  if (!slug) return fallback;
  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const value = Number(service?.duration_minutes || 0);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(240, Math.max(5, value));
}

async function getBookedIntervalsForDate(
  tenantId: string,
  date: string,
  fallbackDurationMinutes: number
): Promise<{ intervals: TimeInterval[]; starts: string[] }> {
  const window = getUtcSearchWindowForDate(date);
  const { data: appointments } = await supabase
    .from("appointments")
    .select("slot_start, service_slug, extra_data")
    .eq("tenant_id", tenantId)
    .gte("slot_start", window.from)
    .lt("slot_start", window.to)
    .neq("status", "cancelled");

  const rows = appointments || [];
  const slugs = [
    ...new Set(rows.map((r) => r.service_slug).filter(Boolean) as string[]),
  ];

  const serviceDuration = new Map<string, number>();
  if (slugs.length > 0) {
    const { data: services } = await supabase
      .from("services")
      .select("slug, duration_minutes")
      .eq("tenant_id", tenantId)
      .in("slug", slugs);
    for (const svc of services || []) {
      serviceDuration.set(
        svc.slug,
        Math.min(240, Math.max(5, Number(svc.duration_minutes || fallbackDurationMinutes)))
      );
    }
  }

  const intervals: TimeInterval[] = [];
  const starts: string[] = [];

  for (const row of rows) {
    const d = new Date(row.slot_start);
    if (isNaN(d.getTime())) continue;
    if (localDateStr(d) !== date) continue;
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    const start = timeToMinutes(time);
    const extraDuration = Number(
      ((row.extra_data as Record<string, unknown> | null)?.duration_minutes as number) || 0
    );
    const duration =
      extraDuration > 0
        ? Math.min(240, Math.max(5, extraDuration))
        : serviceDuration.get(row.service_slug || "") || fallbackDurationMinutes;
    intervals.push({ start, end: start + duration });
    starts.push(time);
  }

  return { intervals, starts };
}

function mergeIntervals(base: TimeInterval[], extra: TimeInterval[]): TimeInterval[] {
  return [...base, ...extra].sort((a, b) => a.start - b.start);
}

function findSuggestedTime(
  requestedTime: string,
  candidates: string[]
): string | undefined {
  if (candidates.length === 0) return undefined;
  const requested = timeToMinutes(requestedTime);
  const later = candidates.find((t) => timeToMinutes(t) > requested);
  return later || candidates[0];
}

export async function getDailyAvailability(
  tenantId: string,
  date: string,
  options?: {
    serviceSlug?: string | null;
    customerPhone?: string;
    configOverride?: Record<string, unknown>;
  }
): Promise<DailyAvailabilityResult> {
  const normalizedDate = normalizeDateString(date);
  if (!normalizedDate) {
    return {
      date,
      available: [],
      booked: [],
      noSchedule: true,
      workingHours: null,
      durationMinutes: 30,
    };
  }

  const blocked = await checkBlockedDate(tenantId, normalizedDate);
  if (blocked) {
    return {
      date: normalizedDate,
      blocked: true,
      available: [],
      booked: [],
      workingHours: null,
      durationMinutes: 30,
    };
  }

  const schedule = await getTenantScheduleContext(
    tenantId,
    normalizedDate,
    options?.configOverride
  );
  if (schedule.noSchedule) {
    return {
      date: normalizedDate,
      available: [],
      booked: [],
      noSchedule: true,
      workingHours: null,
      durationMinutes: schedule.baseSlotMinutes,
    };
  }
  if (schedule.closed) {
    return {
      date: normalizedDate,
      available: [],
      booked: [],
      closed: true,
      workingHours: { start: schedule.startTime, end: schedule.endTime },
      durationMinutes: schedule.baseSlotMinutes,
    };
  }

  const durationMinutes = await getServiceDurationMinutes(
    tenantId,
    options?.serviceSlug,
    schedule.baseSlotMinutes
  );

  const { intervals: appointmentIntervals, starts } = await getBookedIntervalsForDate(
    tenantId,
    normalizedDate,
    schedule.baseSlotMinutes
  );

  const holds = await getBookingHoldsForDate(tenantId, normalizedDate);
  const ownPhone = options?.customerPhone ? normalizePhone(options.customerPhone) : "";
  const holdIntervals: TimeInterval[] = [];
  for (const hold of holds) {
    const holdPhone = normalizePhone(hold.customer_phone);
    if (ownPhone && holdPhone === ownPhone) continue;
    const start = timeToMinutes(hold.time);
    const holdDuration = Math.min(
      240,
      Math.max(5, Number(hold.duration_minutes || schedule.baseSlotMinutes))
    );
    holdIntervals.push({ start, end: start + holdDuration });
  }

  const merged = mergeIntervals(appointmentIntervals, holdIntervals);
  const workStart = timeToMinutes(schedule.startTime);
  const workEnd = timeToMinutes(schedule.endTime);
  const available: string[] = [];
  const now = new Date();
  const todayLocal = localDateStr(now);
  const nowMinutes = localTimeToMinutes(now);
  const sameDayMinStart =
    normalizedDate === todayLocal
      ? nowMinutes + SAME_DAY_MIN_LEAD_MINUTES
      : Number.NEGATIVE_INFINITY;

  for (
    let cursor = workStart;
    cursor + durationMinutes <= workEnd;
    cursor += schedule.baseSlotMinutes
  ) {
    if (cursor < sameDayMinStart) continue;
    const candidate: TimeInterval = {
      start: cursor,
      end: cursor + durationMinutes,
    };
    if (!merged.some((interval) => overlaps(interval, candidate))) {
      available.push(minutesToTime(cursor));
    }
  }

  return {
    date: normalizedDate,
    available,
    booked: starts,
    workingHours: { start: schedule.startTime, end: schedule.endTime },
    durationMinutes,
  };
}

export async function reserveAppointment(
  input: ReserveAppointmentInput
): Promise<ReserveAppointmentResult> {
  const normalizedDate = normalizeDateString(input.date);
  const normalizedTime = normalizeTimeString(input.time);
  if (!normalizedDate || !normalizedTime) {
    return { ok: false, error: "INVALID_DATE_OR_TIME" };
  }

  const lockAcquired = await acquireBookingSlotLock(
    input.tenantId,
    normalizedDate,
    normalizedTime
  );
  if (!lockAcquired) {
    return { ok: false, error: "SLOT_PROCESSING" };
  }

  try {
    const availability = await getDailyAvailability(input.tenantId, normalizedDate, {
      serviceSlug: input.serviceSlug,
      customerPhone: input.customerPhone,
    });

    if (availability.blocked) return { ok: false, error: "BLOCKED_DAY" };
    if (availability.closed) return { ok: false, error: "CLOSED_DAY" };
    if (availability.noSchedule) return { ok: false, error: "NO_SCHEDULE" };

    const requestedAvailable = availability.available.includes(normalizedTime);
    if (!requestedAvailable) {
      return {
        ok: false,
        error: "SLOT_TAKEN",
        suggested_time: findSuggestedTime(normalizedTime, availability.available),
      };
    }

    if (input.holdOnly) {
      const hold = await setBookingSlotHold(
        {
          tenant_id: input.tenantId,
          date: normalizedDate,
          time: normalizedTime,
          customer_phone: input.customerPhone,
          duration_minutes: availability.durationMinutes,
        },
        input.holdTtlSeconds
      );
      return {
        ok: true,
        hold_expires_at: hold.expires_at,
        duration_minutes: availability.durationMinutes,
      };
    }

    const extraData = {
      ...(input.extraData || {}),
      duration_minutes: availability.durationMinutes,
    };
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        tenant_id: input.tenantId,
        customer_phone: input.customerPhone,
        slot_start: `${normalizedDate}T${normalizedTime}:00`,
        status: "confirmed",
        service_slug: input.serviceSlug || null,
        extra_data: extraData,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "SLOT_TAKEN",
          suggested_time: findSuggestedTime(normalizedTime, availability.available),
        };
      }
      return { ok: false, error: error.message };
    }

    await clearBookingSlotHold(input.tenantId, normalizedDate, normalizedTime);
    return { ok: true, id: data?.id };
  } finally {
    await releaseBookingSlotLock(input.tenantId, normalizedDate, normalizedTime);
  }
}
