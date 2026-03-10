export interface Appointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: string;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
}

export interface AvailabilitySlot {
  time: string;
  customer_phone?: string;
  id?: string;
}

export interface AvailabilityData {
  date: string;
  blocked: boolean;
  available: string[];
  booked: AvailabilitySlot[];
  workingHours: { start: string; end: string } | null;
  noSchedule?: boolean;
}

export interface WorkingHoursSlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  day_name?: string;
}

export type ReminderPref = "off" | "customer_only" | "merchant_only" | "both";

export interface BlockedDate {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

export interface ReviewData {
  avgRating: number;
  totalCount: number;
  reviews: Array<{ id: string; rating: number; comment: string | null; created_at: string }>;
}

export interface OpsAlert {
  id: string;
  type: "delay" | "cancellation" | "no_show" | "system";
  severity: "low" | "medium" | "high";
  customer_phone: string | null;
  message: string;
  status: "open" | "resolved";
  created_at: string;
}

export const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export function getWeekDates(anchor: Date): string[] {
  const dates: string[] = [];
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export function groupByDate(apts: Appointment[]): Record<string, Appointment[]> {
  const result: Record<string, Appointment[]> = {};
  for (const a of apts) {
    const k = new Date(a.slot_start).toISOString().split("T")[0] as string;
    (result[k] ??= []).push(a);
  }
  for (const k of Object.keys(result)) {
    (result[k] as Appointment[]).sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
  }
  return result;
}

export function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getAppointmentServiceLabel(apt: Appointment): string {
  const extra = apt.extra_data as { service_name?: string; service_label?: string } | undefined;
  if (extra?.service_name) return extra.service_name;
  if (extra?.service_label) return extra.service_label;
  if (apt.service_slug) return slugToLabel(apt.service_slug);
  return "Randevu";
}
