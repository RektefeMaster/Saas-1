import { create } from "zustand";
import type {
  Appointment,
  BlockedDate,
  OpsAlert,
  ReviewData,
} from "@/app/dashboard/[tenantId]/components/dashboard.types";
import type { CommandCenterSnapshot, CommandCenterAction } from "@/app/dashboard/[tenantId]/components/CommandCenterSection";

export type DashboardView = "overview" | "appointments" | "settings";

interface DashboardStore {
  // Veri state'leri
  appointments: Appointment[];
  blockedDates: BlockedDate[];
  reviews: ReviewData | null;
  opsAlerts: OpsAlert[];
  commandCenter: CommandCenterSnapshot | null;

  // UI state'leri
  activeView: DashboardView;
  selectedDate: string | null;

  // Loading state'leri
  appointmentsLoading: boolean;
  opsAlertsLoading: boolean;
  commandCenterLoading: boolean;

  // Action state'leri
  updatingAptId: string | null;
  resolvingAlertId: string | null;
  runningActionId: string | null;

  // Actions - Veri güncellemeleri
  setAppointments: (appointments: Appointment[]) => void;
  setBlockedDates: (blockedDates: BlockedDate[]) => void;
  setReviews: (reviews: ReviewData | null) => void;
  setOpsAlerts: (opsAlerts: OpsAlert[]) => void;
  setCommandCenter: (commandCenter: CommandCenterSnapshot | null) => void;

  // Actions - UI state'leri
  setActiveView: (view: DashboardView) => void;
  setSelectedDate: (date: string | null) => void;

  // Actions - Loading state'leri
  setAppointmentsLoading: (loading: boolean) => void;
  setOpsAlertsLoading: (loading: boolean) => void;
  setCommandCenterLoading: (loading: boolean) => void;

  // Actions - Action state'leri
  setUpdatingAptId: (id: string | null) => void;
  setResolvingAlertId: (id: string | null) => void;
  setRunningActionId: (id: string | null) => void;

  // Actions - Appointment işlemleri
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  addAppointment: (appointment: Appointment) => void;
  removeAppointment: (id: string) => void;

  // Actions - BlockedDate işlemleri
  addBlockedDate: (blockedDate: BlockedDate) => void;
  removeBlockedDate: (id: string) => void;

  // Actions - OpsAlert işlemleri
  resolveAlert: (id: string) => void;
  addAlert: (alert: OpsAlert) => void;

  // Actions - CommandCenter işlemleri
  runCommandAction: (action: CommandCenterAction) => Promise<void>;

  // Reset - Tenant değiştiğinde tüm state'i sıfırla
  reset: () => void;
}

const initialState = {
  appointments: [],
  blockedDates: [],
  reviews: null,
  opsAlerts: [],
  commandCenter: null,
  activeView: "overview" as DashboardView,
  selectedDate: null,
  appointmentsLoading: true,
  opsAlertsLoading: false,
  commandCenterLoading: false,
  updatingAptId: null,
  resolvingAlertId: null,
  runningActionId: null,
};

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  ...initialState,

  // Veri güncellemeleri
  setAppointments: (appointments) => set({ appointments }),
  setBlockedDates: (blockedDates) => set({ blockedDates }),
  setReviews: (reviews) => set({ reviews }),
  setOpsAlerts: (opsAlerts) => set({ opsAlerts }),
  setCommandCenter: (commandCenter) => set({ commandCenter }),

  // UI state'leri
  setActiveView: (activeView) => set({ activeView }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),

  // Loading state'leri
  setAppointmentsLoading: (appointmentsLoading) => set({ appointmentsLoading }),
  setOpsAlertsLoading: (opsAlertsLoading) => set({ opsAlertsLoading }),
  setCommandCenterLoading: (commandCenterLoading) => set({ commandCenterLoading }),

  // Action state'leri
  setUpdatingAptId: (updatingAptId) => set({ updatingAptId }),
  setResolvingAlertId: (resolvingAlertId) => set({ resolvingAlertId }),
  setRunningActionId: (runningActionId) => set({ runningActionId }),

  // Appointment işlemleri
  updateAppointment: (id, data) =>
    set((state) => ({
      appointments: state.appointments.map((apt) =>
        apt.id === id ? { ...apt, ...data } : apt
      ),
    })),
  addAppointment: (appointment) =>
    set((state) => ({
      appointments: [...state.appointments, appointment],
    })),
  removeAppointment: (id) =>
    set((state) => ({
      appointments: state.appointments.filter((apt) => apt.id !== id),
    })),

  // BlockedDate işlemleri
  addBlockedDate: (blockedDate) =>
    set((state) => ({
      blockedDates: [...state.blockedDates, blockedDate],
    })),
  removeBlockedDate: (id) =>
    set((state) => ({
      blockedDates: state.blockedDates.filter((bd) => bd.id !== id),
    })),

  // OpsAlert işlemleri
  resolveAlert: (id) =>
    set((state) => ({
      opsAlerts: state.opsAlerts.map((alert) =>
        alert.id === id ? { ...alert, status: "resolved" as const } : alert
      ),
    })),
  addAlert: (alert) =>
    set((state) => ({
      opsAlerts: [...state.opsAlerts, alert],
    })),

  // CommandCenter işlemleri
  runCommandAction: async (action) => {
    const { runningActionId, commandCenter } = get();
    if (runningActionId || !commandCenter) return;

    set({ runningActionId: action.id });

    try {
      if (action.id === "reactivation" || action.id === "slot_fill" || action.id === "no_show_mitigation") {
        // tenantId store'da yok, bu yüzden action'dan alınmalı veya parametre olarak geçilmeli
        // Şimdilik action.cta_endpoint kullanıyoruz
        await fetch(action.cta_endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "queue", limit: 20, days: 45 }),
        });
      } else if (action.id === "reputation_recovery") {
        // tenantId'yi endpoint'ten çıkar
        const match = action.cta_endpoint.match(/\/api\/tenant\/([^/]+)\//);
        if (match) {
          await fetch(`/api/tenant/${match[1]}/reputation/summary`);
        }
      } else {
        await fetch(action.cta_endpoint);
      }
      
      // CommandCenter'ı yeniden yükle (bu store action'ı olmalı)
      // Şimdilik sadece state'i temizle, gerçek fetch page.tsx'te yapılacak
    } finally {
      set({ runningActionId: null });
    }
  },

  // Reset
  reset: () => set(initialState),
}));
