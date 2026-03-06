"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Clock,
  Check,
  XOctagon,
  CheckCircle2,
  UserX,
  Loader2,
  Phone,
  BookOpen,
  ChevronDown,
} from "lucide-react";

interface Appointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: string;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
}

interface AppointmentBookProps {
  grouped: Record<string, Appointment[]>;
  sortedDates: string[];
  todayIso: string;
  loading: boolean;
  weekCount: number;
  updatingAptId: string | null;
  onUpdateStatus: (appointmentId: string, status: string) => void;
  getServiceLabel: (apt: Appointment) => string;
  tenantId: string;
}

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const DAY_NAMES_TR = [
  "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
};

function AppointmentBook({
  grouped,
  sortedDates,
  todayIso,
  loading,
  weekCount,
  updatingAptId,
  onUpdateStatus,
  getServiceLabel,
  tenantId,
}: AppointmentBookProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="defter">
        <div className="defter-spiral" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="defter-ring" />
          ))}
        </div>
        <div className="defter-body">
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-amber-800/30" />
            <p className="mt-4 font-serif text-sm text-amber-900/40">
              Defter açılıyor...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <div className="defter">
        <div className="defter-spiral" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="defter-ring" />
          ))}
        </div>
        <div className="defter-body">
          <div className="defter-page-lines" />
          <div className="relative z-10 flex flex-col items-center justify-center py-20">
            <BookOpen className="h-14 w-14 text-amber-800/15" />
            <p className="mt-5 font-serif text-lg text-amber-900/35">
              Defterde henüz randevu yok
            </p>
            <p className="mt-1 font-serif text-sm text-amber-800/25">
              Yeni randevu eklemek için yukarıdaki butonu kullanın
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="defter">
      {/* Spiral binding along the top */}
      <div className="defter-spiral" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="defter-ring" />
        ))}
      </div>

      {/* Book cover header */}
      <div className="defter-cover">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-amber-900/50" />
          <h3 className="font-serif text-lg font-semibold text-amber-900/70">
            Randevu Defteri
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm italic text-amber-800/40">
            {weekCount} kayıt
          </span>
          <Link
            href={`/dashboard/${tenantId}/workflow`}
            className="rounded-lg border border-amber-300/40 bg-amber-50/40 px-3 py-1.5 text-xs font-medium text-amber-800/60 transition hover:bg-amber-100/50"
          >
            İş Akışı →
          </Link>
        </div>
      </div>

      {/* Notebook body */}
      <div className="defter-body">
        {sortedDates.map((date, dateIdx) => {
          const dateObj = new Date(date + "T12:00:00");
          const isToday = date === todayIso;
          const dayName = DAY_NAMES_TR[dateObj.getDay()];
          const dayNum = dateObj.getDate();
          const monthName = MONTH_NAMES_TR[dateObj.getMonth()];
          const appointments = grouped[date] || [];

          return (
            <motion.div
              key={date}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: dateIdx * 0.04, duration: 0.3 }}
              className="defter-gun"
            >
              {/* Date header - like a date stamp */}
              <div className={`defter-tarih ${isToday ? "defter-bugun" : ""}`}>
                <div className="defter-tarih-daire">
                  <span className="defter-tarih-gun">{dayNum}</span>
                </div>
                <div className="defter-tarih-bilgi">
                  <span className="defter-tarih-isim">{dayName}</span>
                  <span className="defter-tarih-ay">
                    {dayNum} {monthName}
                  </span>
                </div>
                {isToday && <span className="defter-bugun-rozet">Bugün</span>}
                <span className="defter-tarih-sayi">
                  {appointments.length} randevu
                </span>
              </div>

              {/* Appointment entries on ruled lines */}
              <div className="defter-satirlar">
                {appointments.map((apt, aptIdx) => {
                  const start = new Date(apt.slot_start);
                  const time = start.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Istanbul",
                  });
                  const name = (
                    apt.extra_data as { customer_name?: string }
                  )?.customer_name;
                  const durationMinutes = (
                    apt.extra_data as { duration_minutes?: number }
                  )?.duration_minutes;
                  const service = getServiceLabel(apt);
                  const isExpanded = expandedEntry === apt.id;
                  const isUpdating = updatingAptId === apt.id;

                  const statusDot =
                    apt.status === "confirmed"
                      ? "defter-dot-onay"
                      : apt.status === "pending"
                        ? "defter-dot-bekle"
                        : apt.status === "completed"
                          ? "defter-dot-tamam"
                          : apt.status === "cancelled"
                            ? "defter-dot-iptal"
                            : "defter-dot-gelmedi";

                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: dateIdx * 0.04 + aptIdx * 0.025,
                      }}
                      className={`defter-satir ${isExpanded ? "defter-satir-acik" : ""} ${
                        apt.status === "cancelled"
                          ? "defter-satir-iptal"
                          : apt.status === "no_show"
                            ? "defter-satir-gelmedi"
                            : ""
                      }`}
                      onClick={() =>
                        setExpandedEntry(isExpanded ? null : apt.id)
                      }
                    >
                      {/* Main line */}
                      <div className="defter-satir-icerik">
                        {/* Time in margin */}
                        <div className="defter-saat">
                          <span>{time}</span>
                        </div>

                        {/* Red margin line sits in CSS */}

                        {/* Entry content */}
                        <div className="defter-detay">
                          <div className="defter-detay-sol">
                            <span className={`defter-dot ${statusDot}`} />
                            <span className="defter-isim">
                              {name || apt.customer_phone}
                            </span>
                            {service !== "Randevu" && (
                              <span className="defter-hizmet">({service})</span>
                            )}
                            {durationMinutes && durationMinutes > 0 && (
                              <span className="defter-sure">
                                {durationMinutes} dk
                              </span>
                            )}
                          </div>
                          <div className="defter-detay-sag">
                            <span className="defter-durum">
                              {STATUS_LABELS[apt.status] || apt.status}
                            </span>
                            <ChevronDown
                              className={`defter-ok ${isExpanded ? "defter-ok-acik" : ""}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail area */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="defter-acilan"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="defter-acilan-ic">
                              {/* Detail rows */}
                              <div className="defter-bilgiler">
                                {name && (
                                  <div className="defter-bilgi-satir">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{apt.customer_phone}</span>
                                  </div>
                                )}
                                <div className="defter-bilgi-satir">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>
                                    {service}
                                    {durationMinutes
                                      ? ` · ${durationMinutes} dk`
                                      : ""}
                                  </span>
                                </div>
                              </div>

                              {/* Action buttons */}
                              {(apt.status === "pending" ||
                                apt.status === "confirmed") && (
                                <div className="defter-aksiyonlar">
                                  {apt.status === "pending" && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() =>
                                          onUpdateStatus(apt.id, "confirmed")
                                        }
                                        className="defter-btn defter-btn-onayla"
                                      >
                                        {isUpdating ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <>
                                            <Check className="h-3.5 w-3.5" />
                                            Onayla
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() =>
                                          onUpdateStatus(apt.id, "cancelled")
                                        }
                                        className="defter-btn defter-btn-iptal"
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
                                        onClick={() =>
                                          onUpdateStatus(apt.id, "completed")
                                        }
                                        className="defter-btn defter-btn-onayla"
                                      >
                                        {isUpdating ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <>
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Tamamlandı
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() =>
                                          onUpdateStatus(apt.id, "no_show")
                                        }
                                        className="defter-btn defter-btn-gelmedi"
                                      >
                                        <UserX className="h-3.5 w-3.5" />
                                        Gelmedi
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() =>
                                          onUpdateStatus(apt.id, "cancelled")
                                        }
                                        className="defter-btn defter-btn-iptal"
                                      >
                                        <XOctagon className="h-3.5 w-3.5" />
                                        İptal
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(AppointmentBook);
