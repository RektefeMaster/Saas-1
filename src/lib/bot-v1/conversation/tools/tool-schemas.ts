/**
 * Zod ile LLM tool argüman doğrulama.
 * LLM bazen formatı bozar (2026/03/04 vs 2026-03-04) - veritabanına bozuk veri girmez.
 */
import { z } from "zod";

// LLM bazen 2026/03/04 gönderir; tire ile normalize et
const dateSchema = z
  .string()
  .transform((s) => s.replace(/\//g, "-").trim())
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD formatında olmalı"))
  .refine((s) => !isNaN(Date.parse(s)), "Geçersiz tarih");

const timeSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().regex(/^\d{1,2}:\d{2}$/, "Saat HH:MM veya H:MM formatında olmalı"))
  .refine((s) => {
    const [h, m] = s.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Geçersiz saat");

export const checkAvailabilitySchema = z.object({
  date: dateSchema,
  service_slug: z.string().optional(),
  staff_id: z.string().optional(),
});

export const matchServiceSchema = z.object({
  user_text: z.string().min(1, "user_text boş olamaz"),
});

export const createAppointmentSchema = z.object({
  date: dateSchema,
  time: timeSchema,
  customer_name: z.string().min(1, "customer_name boş olamaz"),
  service_slug: z.string().min(1, "service_slug boş olamaz"),
  staff_id: z.string().optional(),
  use_package: z.boolean().optional(),
  extra_data: z.record(z.unknown()).optional(),
});

export const cancelAppointmentSchema = z.object({
  appointment_id: z.string().min(1, "appointment_id boş olamaz"),
  reason: z.string().optional(),
});

export const rescheduleAppointmentSchema = z.object({
  appointment_id: z.string().min(1, "appointment_id boş olamaz"),
  new_date: dateSchema,
  new_time: timeSchema,
});

export const checkWeekAvailabilitySchema = z.object({
  start_date: dateSchema,
});

export const addToWaitlistSchema = z.object({
  date: dateSchema,
  preferred_time: timeSchema.optional(),
});

export const notifyLateSchema = z.object({
  minutes: z.number().int().min(1),
  message: z.string().optional(),
});

export const createRecurringSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  time: timeSchema,
});

export const checkCustomerPackageSchema = z.object({
  service_slug: z.string().min(1),
});

const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  check_availability: checkAvailabilitySchema,
  match_service: matchServiceSchema,
  create_appointment: createAppointmentSchema,
  cancel_appointment: cancelAppointmentSchema,
  reschedule_appointment: rescheduleAppointmentSchema,
  check_week_availability: checkWeekAvailabilitySchema,
  add_to_waitlist: addToWaitlistSchema,
  notify_late: notifyLateSchema,
  create_recurring: createRecurringSchema,
  check_customer_package: checkCustomerPackageSchema,
};

export type ToolSchemaName = keyof typeof TOOL_SCHEMAS;

/**
 * Tool argümanlarını doğrular. Hata varsa { success: false, error } döner.
 */
export function validateToolArgs(
  toolName: string,
  args: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return { success: true, data: (args as Record<string, unknown>) || {} };

  const result = schema.safeParse(args);
  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown> };
  }
  const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return {
    success: false,
    error: `Geçersiz parametre: ${issues.join("; ")}`,
  };
}
