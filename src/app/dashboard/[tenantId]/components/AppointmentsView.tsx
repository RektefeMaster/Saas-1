"use client";

import Link from "next/link";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  XCircle,
  XOctagon,
  UserX,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import {
  DAY_NAMES,
  getAppointmentServiceLabel,
  type Appointment,
  type AvailabilityData,
  type BlockedDate,
} from "./dashboard.types";

interface StaffOption {
  id: string;
  name: string;
}

interface AppointmentsViewProps {
  tenantId: string;
  grouped: Record<string, Appointment[]>;
  sortedDates: string[];
  weekDates: string[];
  todayIso: string;
  weekCount: number;
  selectedDate: string | null;
  availability: AvailabilityData | null;
  availabilityLoading: boolean;
  weekAnchor: Date;
  showAdd: boolean;
  addPhone: string;
  addStaffId: string;
  addDate: string;
  addTime: string;
  addDatetimeLocal: string;
  blockedDates: BlockedDate[];
  showBlocked: boolean;
  blockStart: string;
  blockEnd: string;
  blockReason: string;
  loading: boolean;
  updatingAptId: string | null;
  staffPreferenceEnabled: boolean;
  staffOptions: StaffOption[];
  setWeekAnchor: (v: Date | ((prev: Date) => Date)) => void;
  setSelectedDate: (v: string | null) => void;
  setShowAdd: (v: boolean) => void;
  setAddPhone: (v: string) => void;
  setAddStaffId: (v: string) => void;
  setAddDate: (v: string) => void;
  setAddTime: (v: string) => void;
  setAddDatetimeLocal: (v: string) => void;
  setShowBlocked: (v: boolean) => void;
  setBlockStart: (v: string) => void;
  setBlockEnd: (v: string) => void;
  setBlockReason: (v: string) => void;
  onSlotClick: (dateStr: string, timeStr: string) => void;
  onAddAppointment: (e: React.FormEvent) => void;
  onUpdateAppointmentStatus: (appointmentId: string, status: string) => void;
  onAddBlocked: (e: React.FormEvent) => void;
  onDeleteBlocked: (blockId: string) => void;
  onOpenAddFromHeader?: () => void;
}

export function AppointmentsView({
  tenantId,
  grouped,
  sortedDates,
  weekDates,
  todayIso,
  weekCount,
  selectedDate,
  availability,
  availabilityLoading,
  weekAnchor,
  showAdd,
  addPhone,
  addStaffId,
  addDate,
  addTime,
  addDatetimeLocal,
  blockedDates,
  showBlocked,
  blockStart,
  blockEnd,
  blockReason,
  loading,
  updatingAptId,
  staffPreferenceEnabled,
  staffOptions,
  setWeekAnchor,
  setSelectedDate,
  setShowAdd,
  setAddPhone,
  setAddStaffId,
  setAddDate,
  setAddTime,
  setAddDatetimeLocal,
  setShowBlocked,
  setBlockStart,
  setBlockEnd,
  setBlockReason,
  onSlotClick,
  onAddAppointment,
  onUpdateAppointmentStatus,
  onAddBlocked,
  onDeleteBlocked,
}: AppointmentsViewProps) {
  return (
    <>
      <ScrollReveal variant="fadeUp" delay={0.05} as="section" className="mb-6" reduceMotion>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Tarih seç</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ← Önceki
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(new Date())}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Sonraki →
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible">
            {weekDates.map((dateStr) => {
              const d = new Date(dateStr + "T12:00:00");
              const isSelected = selectedDate === dateStr;
              const hasAppts = grouped[dateStr]?.length;
              const isBlocked = blockedDates.some((b) => dateStr >= b.start_date && dateStr <= b.end_date);
              const isPast = dateStr < todayIso;
              const isToday = dateStr === todayIso;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => !isPast && setSelectedDate(dateStr)}
                  disabled={isPast}
                  className={`relative flex min-w-[4rem] flex-col items-center rounded-xl border-2 px-2 py-3 text-sm font-medium transition sm:min-w-0 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-md dark:bg-emerald-600"
                      : isPast
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500"
                        : isBlocked
                          ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200"
                          : isToday
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="text-xs font-semibold opacity-90">{DAY_NAMES[d.getDay()]}</span>
                  <span className="mt-0.5 text-lg font-bold">{d.getDate()}</span>
                  {hasAppts ? (
                    <span
                      className={`mt-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isSelected ? "bg-white/25" : "bg-emerald-500 text-white dark:bg-emerald-500"
                      }`}
                    >
                      {hasAppts}
                    </span>
                  ) : null}
                  {isToday && !isSelected && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </ScrollReveal>

      {selectedDate && (
        <ScrollReveal variant="slideLeft" delay={0} as="section" className="mb-6" reduceMotion>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            {availabilityLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Müsaitlik yükleniyor...</p>
              </div>
            ) : availability?.blocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 py-8 text-center dark:border-amber-800/50 dark:bg-amber-950/20">
                <XCircle className="mx-auto h-10 w-10 text-amber-500 dark:text-amber-400" />
                <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200">Bu gün kapalı</p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">Tatil veya izin günü</p>
              </div>
            ) : availability?.noSchedule ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
                <Clock className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Çalışma saati tanımlı değil</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ayarlardan çalışma saatlerini tanımlayın</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availability?.available && availability.available.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Müsait saatler ({availability.available.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availability.available.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => onSlotClick(selectedDate, time)}
                          className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                        >
                          <Clock className="mr-1.5 inline h-3.5 w-3.5" />
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {availability?.booked && availability.booked.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Dolu saatler ({availability.booked.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availability.booked.map((b) => (
                        <div
                          key={b.time + (b.id ?? "")}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                        >
                          <Clock className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium">{b.time}</span>
                          {b.customer_phone && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">— {b.customer_phone}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!availability?.available || availability.available.length === 0) &&
                  (!availability?.booked || availability.booked.length === 0) && (
                    <div className="rounded-xl bg-slate-50 py-8 text-center dark:bg-slate-800/50">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Bu gün için müsait saat yok</p>
                    </div>
                  )}
              </div>
            )}
          </section>
        </ScrollReveal>
      )}

      {showAdd && (
        <form
          onSubmit={onAddAppointment}
          className="mb-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-6 shadow-lg dark:border-emerald-800 dark:from-slate-900 dark:to-emerald-950/30"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {addDate && addTime
                ? `Randevu Ekle — ${new Date(addDate + "T12:00:00").toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    weekday: "long",
                  })} saat ${addTime}`
                : "Yeni Randevu Ekle"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddDate("");
                setAddTime("");
                setAddDatetimeLocal("");
                setAddPhone("");
                setAddStaffId("");
              }}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {!addDate || !addTime ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tarih ve Saat</label>
                <input
                  type="datetime-local"
                  value={addDatetimeLocal}
                  onChange={(e) => setAddDatetimeLocal(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required={!addDate || !addTime}
                />
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/30">
                <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {new Date(addDate + "T12:00:00").toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    })}
                  </span>
                  <span className="mx-2">•</span>
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{addTime}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddDate("");
                      setAddTime("");
                      setAddDatetimeLocal("");
                    }}
                    className="ml-auto text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Değiştir
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Müşteri Telefonu</label>
              <input
                type="tel"
                placeholder="05XX XXX XX XX"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                required
              />
            </div>
            {staffPreferenceEnabled && staffOptions.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Personel (opsiyonel)</label>
                <select
                  value={addStaffId}
                  onChange={(e) => setAddStaffId(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Otomatik atama</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
              >
                Randevuyu Ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddDate("");
                  setAddTime("");
                  setAddDatetimeLocal("");
                  setAddPhone("");
                  setAddStaffId("");
                }}
                className="rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                İptal
              </button>
            </div>
          </div>
        </form>
      )}

      <ScrollReveal variant="fadeUp" delay={0.1} as="section" className="mb-6" reduceMotion>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Yaklaşan Randevular
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {sortedDates.length > 0 ? `${weekCount} randevu` : "Henüz randevu yok"}
              </p>
            </div>
            {tenantId && sortedDates.length > 0 && (
              <Link
                href={`/dashboard/${tenantId}/workflow`}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              >
                İş akışına git →
              </Link>
            )}
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Randevular yükleniyor...</p>
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">Henüz randevu yok</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Yeni randevu eklemek için yukarıdaki butonu kullanın</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedDates.map((date) => {
                const dateInfo = new Date(date + "T12:00:00");
                const isToday = date === todayIso;
                return (
                  <div key={date} className="px-5 py-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                          isToday ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {dateInfo.getDate()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">
                          {dateInfo.toLocaleDateString("tr-TR", { weekday: "long", month: "long" })}
                        </p>
                        {isToday && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Bugün</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {(grouped[date] ?? []).map((apt) => {
                        const start = new Date(apt.slot_start);
                        const time = start.toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Istanbul",
                        });
                        const durationMinutes = (apt.extra_data as { duration_minutes?: number })?.duration_minutes;
                        const timeLabel = durationMinutes && durationMinutes > 0 ? `${time} · ${durationMinutes} dk` : time;
                        const name = (apt.extra_data as { customer_name?: string })?.customer_name;
                        const statusStyles: Record<string, string> = {
                          confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200",
                          pending: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200",
                          completed: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
                          cancelled: "border-red-100 bg-red-50 text-red-700 line-through opacity-75 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
                          no_show: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-200",
                        };
                        const cardClass = statusStyles[apt.status] ?? "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
                        const isUpdating = updatingAptId === apt.id;
                        return (
                          <div key={apt.id} className={`flex flex-col gap-2 rounded-xl border-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 ${cardClass}`}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                                <span className="font-semibold">{timeLabel}</span>
                                <span className="text-slate-600 dark:text-slate-400">—</span>
                                <span className="truncate">{name || apt.customer_phone}</span>
                              </div>
                              <p className="mt-0.5 text-xs opacity-90">{getAppointmentServiceLabel(apt)}</p>
                            </div>
                            {(apt.status === "pending" || apt.status === "confirmed") && (
                              <div className="flex flex-wrap gap-2 shrink-0">
                                {apt.status === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => onUpdateAppointmentStatus(apt.id, "confirmed")}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                      title="Onayla"
                                    >
                                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Onayla</>}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => onUpdateAppointmentStatus(apt.id, "cancelled")}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                      title="İptal et"
                                    >
                                      <XOctagon className="h-3.5 w-3.5" />
                                      İptal
                                    </button>
                                  </>
                                )}
                                {apt.status === "confirmed" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => onUpdateAppointmentStatus(apt.id, "completed")}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                      title="Tamamlandı"
                                    >
                                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5" /> Tamamlandı</>}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => onUpdateAppointmentStatus(apt.id, "no_show")}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                                      title="Gelmedi"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                      Gelmedi
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => onUpdateAppointmentStatus(apt.id, "cancelled")}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                      title="İptal et"
                                    >
                                      <XOctagon className="h-3.5 w-3.5" />
                                      İptal
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </ScrollReveal>

      <ScrollReveal variant="fadeUp" delay={0.06} as="section" className="mt-8" reduceMotion>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">🏖️ Tatil / İzin Günleri</h3>
          {blockedDates.length > 0 && (
            <ul className="mb-4 space-y-2">
              {blockedDates.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <span>
                    {b.start_date} – {b.end_date}
                    {b.reason && ` (${b.reason})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteBlocked(b.id)}
                    className="rounded-lg px-2 py-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-800/50 dark:hover:text-amber-200"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showBlocked ? (
            <button
              type="button"
              onClick={() => setShowBlocked(true)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              + İzin ekle
            </button>
          ) : (
            <form onSubmit={onAddBlocked} className="flex flex-wrap items-end gap-3">
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
                required
              />
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
                required
              />
              <input
                type="text"
                placeholder="Sebep (opsiyonel)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:flex-1"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 sm:w-auto"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => setShowBlocked(false)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto"
              >
                İptal
              </button>
            </form>
          )}
        </section>
      </ScrollReveal>
    </>
  );
}
