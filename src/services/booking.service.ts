import { supabase } from "@/lib/supabase";
import {
  acquireBookingDayLock,
  acquireBookingSlotLock,
  clearBookingSlotHold,
  getBookingHoldsForDate,
  getBookingHoldsForDates,
  releaseBookingDayLock,
  releaseBookingSlotLock,
  setBookingSlotHold,
  type BookingHoldRecord,
} from "@/lib/redis";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { isCustomerBlocked } from "@/services/blacklist.service";
import { normalizePhoneDigits } from "@/lib/phone";

const DEFAULT_WORKING_HOURS = { start: "09:00", end: "18:00" };
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];
const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";
const DEFAULT_TZ_OFFSET = "+03:00";
const WEEK_AVAILABILITY_MAX_DAYS = 7;
const SAME_DAY_MIN_LEAD_MINUTES = Math.max(
  1,
  Number(process.env.SAME_DAY_MIN_LEAD_MINUTES || 1)
);

/** IANA timezone için UTC offset string döndürür (örn. "+03:00"). Verilen tarih için DST uyumlu. */
function getTimezoneOffsetString(timezone: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tzPart?.startsWith("GMT")) {
      const m = tzPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
      if (m) {
        const sign = m[1];
        const h = (m[2] || "0").padStart(2, "0");
        const min = (m[3] || "00").padStart(2, "0");
        return `${sign}${h}:${min}`;
      }
    }
  } catch {
    // Geçersiz timezone
  }
  return DEFAULT_TZ_OFFSET;
}

interface TimeInterval {
  start: number;
  end: number;
}

interface SlotRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  staff_id?: string | null;
}

interface AppointmentRow {
  slot_start: string;
  service_slug: string | null;
  extra_data: Record<string, unknown> | null;
  staff_id: string | null;
}

interface RecurringRow {
  day_of_week: number;
  time: string;
  customer_phone: string;
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
  /** True when blocked_dates (or related) lookup failed — do not treat as open or blocked. */
  checkFailed?: boolean;
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
  staffId?: string | null;
  serviceSlug?: string | null;
  extraData?: Record<string, unknown>;
  holdOnly?: boolean;
  holdTtlSeconds?: number;
  /** Caller already verified blacklist — skip repeat DB check. */
  skipBlacklistCheck?: boolean;
}

export interface ReserveAppointmentResult {
  ok: boolean;
  id?: string;
  error?: string;
  suggested_time?: string;
  hold_expires_at?: string;
  duration_minutes?: number;
  staff_id?: string | null;
}

/** Single-pass shared context for one or many local dates. */
interface AvailabilityRangeContext {
  tenantId: string;
  timeZone: string;
  configOverride: Record<string, unknown>;
  baseSlotMinutes: number;
  dates: string[];
  blockedDates: Set<string>;
  blockedCheckFailed: boolean;
  slots: SlotRow[];
  appointments: AppointmentRow[];
  serviceDuration: Map<string, number>;
  holdsByDate: Map<string, BookingHoldRecord[]>;
  recurring: RecurringRow[];
  eligibleStaffIds: string[];
  customerPhone?: string;
  serviceSlug?: string | null;
}

function normalizeDateString(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, day] = date.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

/** Timezone-aware UTC window for a local calendar date (±14h covers all offsets). */
function getUtcSearchWindowForDate(
  localDate: string,
  timeZone: string = APP_TIMEZONE
): { from: string; to: string } {
  const ref = new Date(`${localDate}T12:00:00`);
  const offset = getTimezoneOffsetString(timeZone, ref);
  const startLocal = new Date(`${localDate}T00:00:00${offset}`);
  const endLocal = new Date(`${localDate}T23:59:59.999${offset}`);
  if (Number.isNaN(startLocal.getTime()) || Number.isNaN(endLocal.getTime())) {
    const [y, m, d] = localDate.split("-").map(Number);
    return {
      from: new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0)).toISOString(),
      to: new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0)).toISOString(),
    };
  }
  return { from: startLocal.toISOString(), to: endLocal.toISOString() };
}

function getUtcSearchWindowForRange(
  fromDate: string,
  toDate: string,
  timeZone: string
): { from: string; to: string } {
  const start = getUtcSearchWindowForDate(fromDate, timeZone);
  const end = getUtcSearchWindowForDate(toDate, timeZone);
  return { from: start.from, to: end.to };
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
  return normalizePhoneDigits(phone);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function resolveScheduleFromSlots(
  slots: SlotRow[],
  date: string,
  configOverride: Record<string, unknown>,
  baseSlotMinutes: number,
  staffId?: string | null
): TenantScheduleContext {
  const dayOfWeek = getDayOfWeek(date);
  const override = configOverride || {};

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
        baseSlotMinutes,
      };
    }
    return {
      configOverride: override,
      startTime,
      endTime,
      closed: false,
      noSchedule: false,
      baseSlotMinutes,
    };
  }

  const scoped =
    staffId && slots.some((row) => row.staff_id === staffId)
      ? slots.filter((row) => row.staff_id === staffId)
      : slots.filter((row) => row.staff_id == null);
  const fallbackRows = scoped.length > 0 ? scoped : slots;
  const daySlot = fallbackRows.find((s) => s.day_of_week === dayOfWeek);
  if (!daySlot) {
    return {
      configOverride: override,
      startTime: DEFAULT_WORKING_HOURS.start,
      endTime: DEFAULT_WORKING_HOURS.end,
      closed: true,
      noSchedule: false,
      baseSlotMinutes,
    };
  }

  return {
    configOverride: override,
    startTime: daySlot.start_time,
    endTime: daySlot.end_time,
    closed: false,
    noSchedule: false,
    baseSlotMinutes,
  };
}

async function getEligibleStaffIds(
  tenantId: string,
  serviceSlug?: string | null
): Promise<string[]> {
  const staffResult = await supabase
    .from("staff")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (staffResult.error) {
    throw new Error(`staff_query_failed:${staffResult.error.message}`);
  }

  const staffRows = (staffResult.data || []) as Array<{ id: string }>;
  const activeStaffIds = staffRows.map((row) => row.id);
  if (activeStaffIds.length === 0) return [];

  const normalizedServiceSlug = serviceSlug?.trim();
  if (!normalizedServiceSlug) return activeStaffIds;

  const mappingResult = await supabase
    .from("staff_services")
    .select("staff_id")
    .eq("tenant_id", tenantId)
    .eq("service_slug", normalizedServiceSlug)
    .in("staff_id", activeStaffIds);

  if (!mappingResult.error) {
    const mapped = new Set(
      (mappingResult.data || []).map((row) => String(row.staff_id))
    );
    if (mapped.size === 0) return [];
    return activeStaffIds.filter((staffId) => mapped.has(staffId));
  }

  const missingTable = extractMissingSchemaTable(mappingResult.error);
  if (missingTable === "staff_services") {
    return activeStaffIds;
  }

  throw new Error(`staff_services_query_failed:${mappingResult.error.message}`);
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
  const sorted = [...candidates].sort(
    (a, b) => timeToMinutes(a) - timeToMinutes(b)
  );
  let bestAfter: string | undefined;
  let bestAfterDiff = Number.POSITIVE_INFINITY;
  for (const t of sorted) {
    const diff = timeToMinutes(t) - requested;
    if (diff > 0 && diff < bestAfterDiff) {
      bestAfterDiff = diff;
      bestAfter = t;
    }
  }
  if (bestAfter) return bestAfter;
  let bestBefore: string | undefined;
  let bestBeforeDiff = Number.POSITIVE_INFINITY;
  for (const t of sorted) {
    const diff = requested - timeToMinutes(t);
    if (diff > 0 && diff < bestBeforeDiff) {
      bestBeforeDiff = diff;
      bestBefore = t;
    }
  }
  return bestBefore ?? sorted[0];
}

async function loadAvailabilityRangeContext(
  tenantId: string,
  dates: string[],
  options?: {
    staffId?: string | null;
    serviceSlug?: string | null;
    customerPhone?: string;
    configOverride?: Record<string, unknown>;
  }
): Promise<AvailabilityRangeContext> {
  const normalizedDates = [
    ...new Set(
      dates
        .map((d) => normalizeDateString(d))
        .filter((d): d is string => Boolean(d))
    ),
  ].sort();

  if (normalizedDates.length === 0) {
    return {
      tenantId,
      timeZone: APP_TIMEZONE,
      configOverride: options?.configOverride || {},
      baseSlotMinutes: 30,
      dates: [],
      blockedDates: new Set(),
      blockedCheckFailed: false,
      slots: [],
      appointments: [],
      serviceDuration: new Map(),
      holdsByDate: new Map(),
      recurring: [],
      eligibleStaffIds: [],
      customerPhone: options?.customerPhone,
      serviceSlug: options?.serviceSlug,
    };
  }

  const fromDate = normalizedDates[0];
  const toDate = normalizedDates[normalizedDates.length - 1];
  const dayOfWeeks = [...new Set(normalizedDates.map((d) => getDayOfWeek(d)))];

  const [tenantRes, blockedRes, slotsRes, eligibleStaffIds] = await Promise.all([
    supabase
      .from("tenants")
      .select("timezone, config_override")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("blocked_dates")
      .select("start_date, end_date")
      .eq("tenant_id", tenantId)
      .lte("start_date", toDate)
      .gte("end_date", fromDate),
    supabase
      .from("availability_slots")
      .select("day_of_week, start_time, end_time, staff_id")
      .eq("tenant_id", tenantId)
      .in("day_of_week", dayOfWeeks),
    getEligibleStaffIds(tenantId, options?.serviceSlug).catch((err) => {
      console.error("[loadAvailabilityRangeContext] staff eligibility failed:", err);
      return null as string[] | null;
    }),
  ]);

  if (tenantRes.error) {
    throw new Error(`tenant_query_failed:${tenantRes.error.message}`);
  }

  const timeZone =
    (tenantRes.data?.timezone as string | null | undefined)?.trim() || APP_TIMEZONE;
  const configOverride =
    options?.configOverride ||
    ((tenantRes.data?.config_override as Record<string, unknown> | null) || {});
  const baseSlotMinutes = Math.min(
    120,
    Math.max(1, Number(configOverride?.slot_duration_minutes) || 30)
  );

  const blockedCheckFailed = Boolean(blockedRes.error);
  const blockedDates = new Set<string>();
  if (!blockedRes.error) {
    for (const row of blockedRes.data || []) {
      const start = String(row.start_date || "");
      const end = String(row.end_date || "");
      for (const d of normalizedDates) {
        if (d >= start && d <= end) blockedDates.add(d);
      }
    }
  }

  if (slotsRes.error) {
    throw new Error(`availability_slots_query_failed:${slotsRes.error.message}`);
  }
  const slots = (slotsRes.data || []) as SlotRow[];

  if (eligibleStaffIds === null) {
    return {
      tenantId,
      timeZone,
      configOverride,
      baseSlotMinutes,
      dates: normalizedDates,
      blockedDates,
      blockedCheckFailed: true,
      slots,
      appointments: [],
      serviceDuration: new Map(),
      holdsByDate: new Map(normalizedDates.map((d) => [d, []])),
      recurring: [],
      eligibleStaffIds: [],
      customerPhone: options?.customerPhone,
      serviceSlug: options?.serviceSlug,
    };
  }

  const window = getUtcSearchWindowForRange(fromDate, toDate, timeZone);

  const [appointmentsRes, holdsByDate, recurringRes, servicesRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("slot_start, service_slug, extra_data, staff_id")
      .eq("tenant_id", tenantId)
      .gte("slot_start", window.from)
      .lte("slot_start", window.to)
      .neq("status", "cancelled"),
    getBookingHoldsForDates(tenantId, normalizedDates),
    supabase
      .from("recurring_appointments")
      .select("day_of_week, time, customer_phone")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .in("day_of_week", dayOfWeeks),
    supabase
      .from("services")
      .select("slug, duration_minutes")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);

  if (appointmentsRes.error) {
    throw new Error(`appointments_query_failed:${appointmentsRes.error.message}`);
  }
  if (recurringRes.error) {
    throw new Error(`recurring_query_failed:${recurringRes.error.message}`);
  }

  const appointments = (appointmentsRes.data || []).map((row) => ({
    slot_start: row.slot_start,
    service_slug: row.service_slug ?? null,
    extra_data: (row.extra_data as Record<string, unknown> | null) || null,
    staff_id: (row.staff_id as string | null) || null,
  }));

  const serviceDuration = new Map<string, number>();
  for (const svc of servicesRes.data || []) {
    serviceDuration.set(
      svc.slug,
      Math.min(240, Math.max(5, Number(svc.duration_minutes || baseSlotMinutes)))
    );
  }

  // Ensure service slug duration is known even if inactive filter missed it.
  const serviceSlug = options?.serviceSlug?.trim();
  if (serviceSlug && !serviceDuration.has(serviceSlug)) {
    const { data: one } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("tenant_id", tenantId)
      .eq("slug", serviceSlug)
      .limit(1)
      .maybeSingle();
    const value = Number(one?.duration_minutes || 0);
    if (Number.isFinite(value) && value > 0) {
      serviceDuration.set(serviceSlug, Math.min(240, Math.max(5, value)));
    }
  }

  return {
    tenantId,
    timeZone,
    configOverride,
    baseSlotMinutes,
    dates: normalizedDates,
    blockedDates,
    blockedCheckFailed,
    slots,
    appointments,
    serviceDuration,
    holdsByDate,
    recurring: (recurringRes.data || []).map((r) => ({
      day_of_week: Number(r.day_of_week),
      time: String(r.time || ""),
      customer_phone: String(r.customer_phone || ""),
    })),
    eligibleStaffIds,
    customerPhone: options?.customerPhone,
    serviceSlug: options?.serviceSlug,
  };
}

function computeBookedForStaff(
  ctx: AvailabilityRangeContext,
  date: string,
  staffId?: string | null
): { intervals: TimeInterval[]; starts: string[] } {
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ctx.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const intervals: TimeInterval[] = [];
  const starts: string[] = [];

  for (const row of ctx.appointments) {
    if (staffId && row.staff_id && row.staff_id !== staffId) continue;
    if (staffId && !row.staff_id) {
      // Unassigned appointment blocks the pool when filtering a specific staff.
      // Keep previous behavior: staff filter uses eq staff_id, so skip null staff.
      continue;
    }
    const d = new Date(row.slot_start);
    if (isNaN(d.getTime())) continue;
    if (dateFmt.format(d) !== date) continue;
    const time = timeFmt.format(d);
    const start = timeToMinutes(time);
    const extraDuration = Number(
      (row.extra_data as Record<string, unknown> | null)?.duration_minutes || 0
    );
    const duration =
      extraDuration > 0
        ? Math.min(240, Math.max(5, extraDuration))
        : ctx.serviceDuration.get(row.service_slug || "") || ctx.baseSlotMinutes;
    intervals.push({ start, end: start + duration });
    starts.push(time);
  }

  return { intervals, starts };
}

function computeDailyAvailabilityFromContext(
  ctx: AvailabilityRangeContext,
  date: string,
  staffId?: string | null
): DailyAvailabilityResult {
  const normalizedDate = normalizeDateString(date);
  if (!normalizedDate) {
    return {
      date,
      available: [],
      booked: [],
      noSchedule: true,
      workingHours: null,
      durationMinutes: ctx.baseSlotMinutes,
    };
  }

  if (ctx.blockedCheckFailed) {
    return {
      date: normalizedDate,
      checkFailed: true,
      available: [],
      booked: [],
      workingHours: null,
      durationMinutes: ctx.baseSlotMinutes,
    };
  }

  if (ctx.blockedDates.has(normalizedDate)) {
    return {
      date: normalizedDate,
      blocked: true,
      available: [],
      booked: [],
      workingHours: null,
      durationMinutes: ctx.baseSlotMinutes,
    };
  }

  const schedule = resolveScheduleFromSlots(
    ctx.slots,
    normalizedDate,
    ctx.configOverride,
    ctx.baseSlotMinutes,
    staffId
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

  const durationMinutes =
    (ctx.serviceSlug && ctx.serviceDuration.get(ctx.serviceSlug.trim())) ||
    schedule.baseSlotMinutes;

  const booked = computeBookedForStaff(ctx, normalizedDate, staffId);
  const ownPhone = ctx.customerPhone ? normalizePhone(ctx.customerPhone) : "";

  const holdIntervals: TimeInterval[] = [];
  for (const hold of ctx.holdsByDate.get(normalizedDate) || []) {
    const holdStaffId =
      typeof hold.staff_id === "string" ? hold.staff_id.trim() : "";
    if (staffId && holdStaffId && holdStaffId !== staffId) continue;
    const holdPhone = normalizePhone(hold.customer_phone);
    if (ownPhone && holdPhone === ownPhone) continue;
    const start = timeToMinutes(hold.time);
    const holdDuration = Math.min(
      240,
      Math.max(5, Number(hold.duration_minutes || schedule.baseSlotMinutes))
    );
    holdIntervals.push({ start, end: start + holdDuration });
  }

  const recurringIntervals: TimeInterval[] = [];
  const dayOfWeek = getDayOfWeek(normalizedDate);
  for (const row of ctx.recurring) {
    if (row.day_of_week !== dayOfWeek) continue;
    const recurringPhone = normalizePhone(String(row.customer_phone || ""));
    if (ownPhone && recurringPhone && recurringPhone === ownPhone) continue;
    const t = normalizeTimeString(String(row.time || ""));
    if (!t) continue;
    const start = timeToMinutes(t);
    recurringIntervals.push({
      start,
      end: start + schedule.baseSlotMinutes,
    });
  }

  const merged = mergeIntervals(
    mergeIntervals(booked.intervals, holdIntervals),
    recurringIntervals
  );
  const workStart = timeToMinutes(schedule.startTime);
  const workEnd = timeToMinutes(schedule.endTime);
  const available: string[] = [];
  const now = new Date();
  const todayLocal = localDateStr(now, ctx.timeZone);
  const nowMinutes = localTimeToMinutes(now, ctx.timeZone);
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
    booked: booked.starts,
    workingHours: { start: schedule.startTime, end: schedule.endTime },
    durationMinutes,
  };
}

function unionStaffAvailability(
  ctx: AvailabilityRangeContext,
  date: string
): DailyAvailabilityResult {
  const staffIds = ctx.eligibleStaffIds;
  if (staffIds.length === 0) {
    return computeDailyAvailabilityFromContext(ctx, date, null);
  }

  const availableSet = new Set<string>();
  const bookedSet = new Set<string>();
  let workingHours: DailyAvailabilityResult["workingHours"] = null;
  let durationMinutes = ctx.baseSlotMinutes;
  let sawOpen = false;
  let sawBlocked = false;
  let sawClosed = false;
  let sawNoSchedule = false;
  let sawCheckFailed = false;

  for (const staffId of staffIds) {
    const daily = computeDailyAvailabilityFromContext(ctx, date, staffId);
    if (daily.checkFailed) {
      sawCheckFailed = true;
      continue;
    }
    if (daily.blocked) {
      sawBlocked = true;
      continue;
    }
    if (daily.closed) {
      sawClosed = true;
      continue;
    }
    if (daily.noSchedule) {
      sawNoSchedule = true;
      continue;
    }
    sawOpen = true;
    durationMinutes = daily.durationMinutes;
    workingHours = daily.workingHours;
    for (const t of daily.available) availableSet.add(t);
    for (const t of daily.booked) bookedSet.add(t);
  }

  if (!sawOpen) {
    if (sawCheckFailed) {
      return {
        date,
        checkFailed: true,
        available: [],
        booked: [],
        workingHours: null,
        durationMinutes,
      };
    }
    if (sawBlocked && !sawClosed && !sawNoSchedule) {
      return {
        date,
        blocked: true,
        available: [],
        booked: [],
        workingHours: null,
        durationMinutes,
      };
    }
    if (sawClosed) {
      return {
        date,
        closed: true,
        available: [],
        booked: [],
        workingHours,
        durationMinutes,
      };
    }
    return {
      date,
      noSchedule: true,
      available: [],
      booked: [],
      workingHours: null,
      durationMinutes,
    };
  }

  const sortTimes = (times: string[]) =>
    [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  return {
    date,
    available: sortTimes([...availableSet]),
    booked: sortTimes([...bookedSet]),
    workingHours,
    durationMinutes,
  };
}

function staffLoadFromContext(
  ctx: AvailabilityRangeContext,
  date: string,
  staffIds: string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const staffSet = new Set(staffIds);
  for (const row of ctx.appointments) {
    if (!row.staff_id || !staffSet.has(row.staff_id)) continue;
    const d = new Date(row.slot_start);
    if (Number.isNaN(d.getTime())) continue;
    if (dateFmt.format(d) !== date) continue;
    counts.set(row.staff_id, (counts.get(row.staff_id) || 0) + 1);
  }
  return counts;
}

function findStaffForRequestedSlotFromContext(
  ctx: AvailabilityRangeContext,
  date: string,
  requestedTime: string
): {
  staffId: string | null;
  availableTimes: string[];
  hadEligibleStaff: boolean;
  dailyByStaff: Map<string, DailyAvailabilityResult>;
} {
  const eligibleStaffIds = ctx.eligibleStaffIds;
  if (eligibleStaffIds.length === 0) {
    return {
      staffId: null,
      availableTimes: [],
      hadEligibleStaff: false,
      dailyByStaff: new Map(),
    };
  }

  const loadByStaff = staffLoadFromContext(ctx, date, eligibleStaffIds);
  const orderedStaffIds = [...eligibleStaffIds].sort((a, b) => {
    const loadA = loadByStaff.get(a) || 0;
    const loadB = loadByStaff.get(b) || 0;
    if (loadA !== loadB) return loadA - loadB;
    return a.localeCompare(b);
  });

  const aggregate = new Set<string>();
  const dailyByStaff = new Map<string, DailyAvailabilityResult>();
  let sawCheckFailed = false;

  for (const staffId of orderedStaffIds) {
    const daily = computeDailyAvailabilityFromContext(ctx, date, staffId);
    dailyByStaff.set(staffId, daily);
    if (daily.checkFailed) {
      sawCheckFailed = true;
      continue;
    }
    for (const slot of daily.available) aggregate.add(slot);
    if (daily.available.includes(requestedTime)) {
      return {
        staffId,
        availableTimes: [...aggregate],
        hadEligibleStaff: true,
        dailyByStaff,
      };
    }
  }

  if (sawCheckFailed && aggregate.size === 0) {
    throw new Error("availability_check_failed");
  }

  return {
    staffId: null,
    availableTimes: [...aggregate],
    hadEligibleStaff: true,
    dailyByStaff,
  };
}

export async function getDailyAvailability(
  tenantId: string,
  date: string,
  options?: {
    staffId?: string | null;
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

  try {
    const ctx = await loadAvailabilityRangeContext(tenantId, [normalizedDate], options);
    if (ctx.blockedCheckFailed && ctx.eligibleStaffIds.length === 0 && options?.staffId == null) {
      // staff eligibility failed surfaced as checkFailed above
    }
    if (options?.staffId) {
      return computeDailyAvailabilityFromContext(ctx, normalizedDate, options.staffId);
    }
    if (ctx.eligibleStaffIds.length >= 1) {
      return unionStaffAvailability(ctx, normalizedDate);
    }
    return computeDailyAvailabilityFromContext(ctx, normalizedDate, null);
  } catch (err) {
    console.error("[getDailyAvailability] failed:", err);
    return {
      date: normalizedDate,
      checkFailed: true,
      available: [],
      booked: [],
      workingHours: null,
      durationMinutes: 30,
    };
  }
}

/**
 * Next up to 7 days of availability in a single DB/Redis batch.
 * Used by check_week_availability tool (never N× getDailyAvailability).
 */
export async function getAvailabilityRange(
  tenantId: string,
  startDate: string,
  options?: {
    serviceSlug?: string | null;
    customerPhone?: string;
    configOverride?: Record<string, unknown>;
    maxDays?: number;
  }
): Promise<{
  days: Record<string, string[]>;
  closedDays: string[];
  message?: string;
}> {
  const normalizedStart = normalizeDateString(startDate);
  if (!normalizedStart) {
    return { days: {}, closedDays: [], message: "Geçersiz tarih formatı" };
  }

  const maxDays = Math.min(
    WEEK_AVAILABILITY_MAX_DAYS,
    Math.max(1, options?.maxDays ?? WEEK_AVAILABILITY_MAX_DAYS)
  );
  // Geçmiş gün filtresi tenant timezone'u bilinmeden yapılamaz; adaylar burada
  // üretilir, ctx yüklendikten sonra ctx.timeZone ile elenir.
  const dates: string[] = [];
  for (let i = 0; i < maxDays; i++) {
    dates.push(addDays(normalizedStart, i));
  }

  if (dates.length === 0) {
    return {
      days: {},
      closedDays: [],
      message: `Önümüzdeki ${maxDays} gün içinde müsait gün bulunamadı.`,
    };
  }

  try {
    const ctx = await loadAvailabilityRangeContext(tenantId, dates, {
      serviceSlug: options?.serviceSlug,
      customerPhone: options?.customerPhone,
      configOverride: options?.configOverride,
    });

    const weekResults: Record<string, string[]> = {};
    const closedDays: string[] = [];
    const todayLocal = localDateStr(new Date(), ctx.timeZone);

    for (const ds of dates) {
      if (ds < todayLocal) continue;
      const daily =
        ctx.eligibleStaffIds.length >= 1
          ? unionStaffAvailability(ctx, ds)
          : computeDailyAvailabilityFromContext(ctx, ds, null);

      if (daily.checkFailed || daily.blocked) continue;
      if (daily.closed) {
        closedDays.push(ds);
        continue;
      }
      if (daily.noSchedule) continue;
      if (daily.available.length > 0) {
        weekResults[ds] = daily.available;
      }
    }

    if (Object.keys(weekResults).length > 0) {
      return { days: weekResults, closedDays };
    }
    return {
      days: {},
      closedDays,
      message: `Önümüzdeki ${maxDays} gün içinde müsait gün bulunamadı.`,
    };
  } catch (err) {
    console.error("[getAvailabilityRange] failed:", err);
    return {
      days: {},
      closedDays: [],
      message: "Müsaitlik kontrolü başarısız.",
    };
  }
}

export async function reserveAppointment(
  input: ReserveAppointmentInput
): Promise<ReserveAppointmentResult> {
  const normalizedDate = normalizeDateString(input.date);
  const normalizedTime = normalizeTimeString(input.time);
  if (!normalizedDate || !normalizedTime) {
    return { ok: false, error: "INVALID_DATE_OR_TIME" };
  }

  if (!input.skipBlacklistCheck) {
    if (await isCustomerBlocked(input.tenantId, input.customerPhone)) {
      return { ok: false, error: "CUSTOMER_BLOCKED" };
    }
  }

  const dayLockAcquired = await acquireBookingDayLock(input.tenantId, normalizedDate);
  if (!dayLockAcquired) {
    return { ok: false, error: "SLOT_PROCESSING" };
  }

  const lockAcquired = await acquireBookingSlotLock(
    input.tenantId,
    normalizedDate,
    normalizedTime
  );
  if (!lockAcquired) {
    await releaseBookingDayLock(input.tenantId, normalizedDate);
    return { ok: false, error: "SLOT_PROCESSING" };
  }

  try {
    let ctx: AvailabilityRangeContext;
    try {
      ctx = await loadAvailabilityRangeContext(input.tenantId, [normalizedDate], {
        serviceSlug: input.serviceSlug,
        customerPhone: input.customerPhone,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("_query_failed") || msg.includes("booking_holds_unavailable")) {
        return { ok: false, error: "AVAILABILITY_CHECK_FAILED" };
      }
      throw err;
    }

    // Refresh holds under lock (TOCTOU) — single date mget, cheap.
    try {
      const freshHolds = await getBookingHoldsForDate(input.tenantId, normalizedDate);
      ctx.holdsByDate.set(normalizedDate, freshHolds);
    } catch {
      return { ok: false, error: "AVAILABILITY_CHECK_FAILED" };
    }

    let resolvedStaffId =
      typeof input.staffId === "string" && input.staffId.trim()
        ? input.staffId.trim()
        : null;

    let availability: DailyAvailabilityResult;

    if (!resolvedStaffId) {
      let staffMatch: ReturnType<typeof findStaffForRequestedSlotFromContext>;
      try {
        staffMatch = findStaffForRequestedSlotFromContext(
          ctx,
          normalizedDate,
          normalizedTime
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("availability_check_failed")) {
          return { ok: false, error: "AVAILABILITY_CHECK_FAILED" };
        }
        throw err;
      }

      if (staffMatch.hadEligibleStaff && !staffMatch.staffId) {
        return {
          ok: false,
          error: "SLOT_TAKEN",
          suggested_time: findSuggestedTime(normalizedTime, staffMatch.availableTimes),
        };
      }

      resolvedStaffId = staffMatch.staffId;
      availability = resolvedStaffId
        ? staffMatch.dailyByStaff.get(resolvedStaffId) ||
          computeDailyAvailabilityFromContext(ctx, normalizedDate, resolvedStaffId)
        : computeDailyAvailabilityFromContext(ctx, normalizedDate, null);
    } else {
      availability = computeDailyAvailabilityFromContext(
        ctx,
        normalizedDate,
        resolvedStaffId
      );
    }

    if (availability.checkFailed) return { ok: false, error: "AVAILABILITY_CHECK_FAILED" };
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
          staff_id: resolvedStaffId || null,
          customer_phone: input.customerPhone,
          duration_minutes: availability.durationMinutes,
        },
        input.holdTtlSeconds
      );
      if (!hold) {
        return { ok: false, error: "SLOT_TAKEN" };
      }
      return {
        ok: true,
        hold_expires_at: hold.expires_at,
        duration_minutes: availability.durationMinutes,
        staff_id: resolvedStaffId,
      };
    }

    const extraData = {
      ...(input.extraData || {}),
      duration_minutes: availability.durationMinutes,
    };

    const tenantTimezone = ctx.timeZone;
    const refDate = new Date(`${normalizedDate}T12:00:00`);
    const tzOffset = getTimezoneOffsetString(tenantTimezone, refDate);
    const localSlot = `${normalizedDate}T${normalizedTime}:00${tzOffset}`;
    const slotStartIso = new Date(localSlot).toISOString();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        tenant_id: input.tenantId,
        staff_id: resolvedStaffId || null,
        customer_phone: input.customerPhone,
        slot_start: slotStartIso,
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

    await clearBookingSlotHold(
      input.tenantId,
      normalizedDate,
      normalizedTime,
      resolvedStaffId
    );
    return { ok: true, id: data?.id, staff_id: resolvedStaffId };
  } finally {
    await releaseBookingSlotLock(input.tenantId, normalizedDate, normalizedTime);
    await releaseBookingDayLock(input.tenantId, normalizedDate);
  }
}
