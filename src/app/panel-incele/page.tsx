"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  Send,
  Settings,
  Target,
  UserRound,
  Users,
  X,
  XCircle,
  UserX,
} from "lucide-react";
import { ThemeLocaleSwitch } from "@/components/ui";
import { GuideModal } from "./GuideModal";
import {
  DEMO_ACTIONS,
  DEMO_BUSINESS,
  DEMO_CAMPAIGNS,
  DEMO_CUSTOMERS,
  DEMO_GUIDES,
  DEMO_KPIS,
  DEMO_MESSAGES,
  DEMO_PACKAGES,
  DEMO_PRICING,
  DEMO_STAFF,
  INITIAL_ALERTS,
  buildInitialAppointments,
  type AptStatus,
  type DemoAppointment,
  type DemoMessage,
  type DemoNavKey,
} from "./data";

const NAV: { key: DemoNavKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Özet", icon: LayoutDashboard },
  { key: "appointments", label: "Randevular", icon: CalendarDays },
  { key: "messages", label: "Mesajlar", icon: MessageCircle },
  { key: "workflow", label: "İş Akışı", icon: KanbanSquare },
  { key: "crm", label: "Müşteri Defteri", icon: Users },
  { key: "campaigns", label: "Kampanyalar", icon: Send },
  { key: "pricing", label: "Fiyat Listesi", icon: ListChecks },
  { key: "packages", label: "Paket & Seans", icon: Package },
  { key: "staff", label: "Personel", icon: UserRound },
  { key: "settings", label: "Ayarlar", icon: Settings },
];

const STATUS_LABEL: Record<AptStatus, string> = {
  pending: "Bekliyor",
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
};

const STATUS_STYLE: Record<AptStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200",
  completed: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  cancelled: "border-red-100 bg-red-50 text-red-700 line-through opacity-75 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  no_show: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-200",
};

export default function PanelIncelePage() {
  const [nav, setNav] = useState<DemoNavKey>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [appointments, setAppointments] = useState<DemoAppointment[]>(() => buildInitialAppointments());
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [messages, setMessages] = useState(DEMO_MESSAGES);
  const [selectedMessage, setSelectedMessage] = useState<string>(DEMO_MESSAGES[0]?.id ?? "");
  const [selectedCustomer, setSelectedCustomer] = useState(DEMO_CUSTOMERS[0]?.id ?? "");
  const [crmQuery, setCrmQuery] = useState("");
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [seenGuides, setSeenGuides] = useState<Partial<Record<DemoNavKey, boolean>>>({});
  const [guideOpen, setGuideOpen] = useState(true);
  const [reply, setReply] = useState("");
  const [campaignDraft, setCampaignDraft] = useState(
    "Merhaba {{ad}}, sizi özledik. Bu hafta bakımda %15 — yazmanız yeterli."
  );
  const [welcomeMsg, setWelcomeMsg] = useState(
    "Merhaba! Salon Mira’ya hoş geldiniz. Randevu, fiyat veya müsait saat için yazmanız yeterli."
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ahi-demo-guides");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<DemoNavKey, boolean>>;
      setSeenGuides(parsed);
      if (parsed.overview) setGuideOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const openGuide = useCallback((key: DemoNavKey, force = false) => {
    if (!force && seenGuides[key]) {
      setGuideOpen(false);
      return;
    }
    setGuideOpen(true);
  }, [seenGuides]);

  const goNav = useCallback(
    (key: DemoNavKey) => {
      setNav(key);
      setMobileNav(false);
      openGuide(key);
    },
    [openGuide]
  );

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    setSeenGuides((prev) => {
      const next = { ...prev, [nav]: true };
      try {
        sessionStorage.setItem("ahi-demo-guides", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [nav]);

  const updateStatus = (id: string, status: AptStatus) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    showToast(`Randevu durumu: ${STATUS_LABEL[status]}`);
  };

  const runAction = async (id: string) => {
    setRunningAction(id);
    await new Promise((r) => setTimeout(r, 900));
    if (id === "act1") {
      setAppointments((prev) =>
        prev.map((a) => (a.status === "pending" && a.dayKey === "today" ? { ...a, status: "confirmed" } : a))
      );
      showToast("Bekleyen randevular onaylandı (demo)");
    } else if (id === "act2") {
      goNav("campaigns");
      showToast("Geri kazanım taslağı kampanyalara taşındı");
    } else {
      showToast("Yarınki hatırlatmalar kuyruğa alındı (demo)");
    }
    setRunningAction(null);
  };

  const unreadCount = messages.filter((m) => m.unread).length;
  const todayApts = appointments.filter((a) => a.dayKey === "today");
  const pendingToday = todayApts.filter((a) => a.status === "pending").length;
  const openAlerts = alerts.filter((a) => !a.resolved);

  const activeMessage = messages.find((m) => m.id === selectedMessage) ?? messages[0];
  const filteredCustomers = DEMO_CUSTOMERS.filter(
    (c) =>
      !crmQuery ||
      c.name.toLowerCase().includes(crmQuery.toLowerCase()) ||
      c.phone.includes(crmQuery) ||
      c.tags.some((t) => t.toLowerCase().includes(crmQuery.toLowerCase()))
  );
  const activeCustomer = DEMO_CUSTOMERS.find((c) => c.id === selectedCustomer) ?? DEMO_CUSTOMERS[0];

  const workflowColumns = useMemo(() => {
    const cols: { key: AptStatus; label: string; items: DemoAppointment[] }[] = [
      { key: "pending", label: "Bekleyen", items: [] },
      { key: "confirmed", label: "Onaylı", items: [] },
      { key: "completed", label: "Tamamlandı", items: [] },
      { key: "cancelled", label: "İptal", items: [] },
      { key: "no_show", label: "Gelmedi", items: [] },
    ];
    for (const apt of appointments) {
      const col = cols.find((c) => c.key === apt.status);
      col?.items.push(apt);
    }
    return cols;
  }, [appointments]);

  const markMessageRead = (msg: DemoMessage) => {
    setSelectedMessage(msg.id);
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m)));
  };

  const sendReply = () => {
    if (!reply.trim() || !activeMessage) return;
    const text = reply.trim();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === activeMessage.id
          ? {
              ...m,
              preview: text,
              time: "Şimdi",
              thread: [...m.thread, { from: "staff" as const, text, time: "Şimdi" }],
            }
          : m
      )
    );
    setReply("");
    showToast("Yanıt gönderildi (demo)");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Demo top bar */}
      <div className="sticky top-0 z-50 border-b border-emerald-800/20 bg-emerald-700 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1.5 font-medium text-emerald-50 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Ana sayfa
            </Link>
            <span className="hidden h-4 w-px bg-white/30 sm:block" />
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
              Demo panel · Sahte veriler
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              Bu sayfa nedir?
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Gerçek giriş
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-7xl">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800">
            <Image src="/appicon.png" alt="" width={32} height={32} className="rounded-lg border border-slate-200 bg-white p-0.5" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{DEMO_BUSINESS.name}</p>
              <p className="truncate text-xs text-slate-500">{DEMO_BUSINESS.code}</p>
            </div>
          </div>
          <nav className="space-y-0.5 p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = nav === item.key;
              const badge = item.key === "messages" ? unreadCount : item.key === "appointments" ? pendingToday : 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goNav(item.key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-[44px] z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden dark:border-slate-700"
                  onClick={() => setMobileNav(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-base font-semibold sm:text-lg">{DEMO_GUIDES[nav].title.split("—")[0].trim()}</h1>
                  <p className="text-xs text-slate-500">
                    {DEMO_BUSINESS.sector} · {DEMO_BUSINESS.city}
                  </p>
                </div>
              </div>
              <ThemeLocaleSwitch compact />
            </div>
          </header>

          <main className="flex-1 px-4 py-5 pb-28 sm:px-6 lg:pb-8">
            {nav === "overview" && (
              <OverviewView
                appointments={todayApts}
                alerts={openAlerts}
                runningAction={runningAction}
                onRunAction={runAction}
                onResolve={(id) => {
                  setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
                  showToast("Bildirim çözüldü");
                }}
                onGotoAppointments={() => goNav("appointments")}
              />
            )}
            {nav === "appointments" && (
              <AppointmentsView appointments={appointments} onUpdateStatus={updateStatus} onToast={showToast} />
            )}
            {nav === "messages" && (
              <MessagesView
                messages={messages}
                active={activeMessage}
                reply={reply}
                onReplyChange={setReply}
                onSelect={markMessageRead}
                onSend={sendReply}
              />
            )}
            {nav === "workflow" && (
              <WorkflowView
                columns={workflowColumns}
                onMove={(id, status) => updateStatus(id, status)}
              />
            )}
            {nav === "crm" && (
              <CrmView
                customers={filteredCustomers}
                selected={activeCustomer}
                query={crmQuery}
                onQuery={setCrmQuery}
                onSelect={setSelectedCustomer}
              />
            )}
            {nav === "campaigns" && (
              <CampaignsView
                draft={campaignDraft}
                onDraft={setCampaignDraft}
                onSend={() => showToast("Kampanya demo olarak ‘gönderildi’ (28 alıcı)")}
              />
            )}
            {nav === "pricing" && <PricingView />}
            {nav === "packages" && <PackagesView />}
            {nav === "staff" && <StaffView />}
            {nav === "settings" && (
              <SettingsView
                welcomeMsg={welcomeMsg}
                onWelcome={setWelcomeMsg}
                onSave={() => showToast("Ayarlar kaydedildi (demo)")}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">{DEMO_BUSINESS.name}</p>
              <button type="button" onClick={() => setMobileNav(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => goNav(item.key)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      nav === item.key ? "bg-emerald-600 text-white" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {NAV.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = nav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goNav(item.key)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium ${
                  active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </nav>

      {guideOpen && <GuideModal navKey={nav} onClose={closeGuide} />}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg lg:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function OverviewView({
  appointments,
  alerts,
  runningAction,
  onRunAction,
  onResolve,
  onGotoAppointments,
}: {
  appointments: DemoAppointment[];
  alerts: typeof INITIAL_ALERTS;
  runningAction: string | null;
  onRunAction: (id: string) => void;
  onResolve: (id: string) => void;
  onGotoAppointments: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{DEMO_BUSINESS.name}</h2>
          <p className="text-sm text-slate-500">İşletme kodu: {DEMO_BUSINESS.code}</p>
        </div>
        <button
          type="button"
          onClick={onGotoAppointments}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Randevu Ekle
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Bugün", value: DEMO_KPIS.todayCount, hint: "randevu" },
          { label: "Aylık", value: DEMO_KPIS.monthCount, hint: "randevu" },
          { label: "Doluluk", value: `%${DEMO_KPIS.fillRate}`, hint: "oran" },
          { label: "Puan", value: DEMO_KPIS.avgRating, hint: "ortalama" },
        ].map((s) => (
          <div key={s.label} className="panel-muted px-3.5 py-3">
            <span className="text-xs font-medium text-slate-500">{s.label}</span>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-500">{s.hint}</p>
          </div>
        ))}
      </div>

      <section className="panel-surface p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-emerald-600" />
            Kontrol Merkezi
          </h3>
          <p className="mt-1 text-sm text-slate-500">Gelir ve günlük aksiyonları buradan yönetin</p>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Aylık Ciro", value: `${DEMO_KPIS.monthlyRevenue.toLocaleString("tr-TR")} ₺` },
            { label: "Doluluk", value: `%${DEMO_KPIS.fillRate}` },
            { label: "Gelmeme", value: `%${DEMO_KPIS.noShowRate}` },
            { label: "Riskli Müşteri", value: String(DEMO_KPIS.atRisk) },
          ].map((kpi) => (
            <div key={kpi.label} className="panel-muted px-4 py-3.5">
              <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {DEMO_ACTIONS.map((action) => (
            <div
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      action.severity === "high" ? "bg-red-500" : action.severity === "medium" ? "bg-amber-500" : "bg-slate-400"
                    }`}
                  />
                  <p className="text-sm font-semibold">{action.title}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{action.description}</p>
                {action.impact > 0 && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Tahmini etki: {action.impact.toLocaleString("tr-TR")} ₺
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={runningAction === action.id}
                onClick={() => onRunAction(action.id)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {runningAction === action.id ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Çalışıyor…
                  </span>
                ) : (
                  action.cta
                )}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-surface p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          Açık bildirimler
        </h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Tüm bildirimler çözüldü.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <div>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{a.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onResolve(a.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700"
                >
                  Çözüldü
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-surface p-5">
        <h3 className="mb-3 font-semibold">Bugünün programı</h3>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {appointments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {a.time} · {a.customer}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {a.service} · {a.staff}
                </p>
              </div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${STATUS_STYLE[a.status]}`}>
                {STATUS_LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AppointmentsView({
  appointments,
  onUpdateStatus,
  onToast,
}: {
  appointments: DemoAppointment[];
  onUpdateStatus: (id: string, status: AptStatus) => void;
  onToast: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "today" | "tomorrow">("today");
  const list = appointments.filter((a) => (filter === "all" ? true : a.dayKey === filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ["today", "Bugün"],
              ["tomorrow", "Yarın"],
              ["all", "Tümü"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                filter === key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onToast("Demo’da yeni randevu formu simüle edildi")}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Randevu Ekle
        </button>
      </div>

      <div className="space-y-3">
        {list.map((apt) => (
          <div
            key={apt.id}
            className={`flex flex-col gap-3 rounded-xl border-2 px-4 py-3 sm:flex-row sm:items-center ${STATUS_STYLE[apt.status]}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 opacity-70" />
                <span className="font-semibold">
                  {apt.time}–{apt.end} · {apt.duration} dk
                </span>
                <span className="text-xs opacity-70">{apt.dateLabel}</span>
              </div>
              <p className="mt-1 font-medium">
                {apt.customer}{" "}
                <span className="font-normal opacity-70">· {apt.phone}</span>
              </p>
              <p className="text-xs opacity-90">
                {apt.service} · {apt.staff} · {apt.price.toLocaleString("tr-TR")} ₺
              </p>
              {apt.note && <p className="mt-1 text-xs italic opacity-80">{apt.note}</p>}
            </div>
            {(apt.status === "pending" || apt.status === "confirmed") && (
              <div className="flex flex-wrap gap-2">
                {apt.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(apt.id, "confirmed")}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(apt.id, "cancelled")}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reddet
                    </button>
                  </>
                )}
                {apt.status === "confirmed" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(apt.id, "completed")}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Tamamla
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(apt.id, "no_show")}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-orange-800"
                    >
                      <UserX className="h-3.5 w-3.5" /> Gelmedi
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(apt.id, "cancelled")}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      İptal
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesView({
  messages,
  active,
  reply,
  onReplyChange,
  onSelect,
  onSend,
}: {
  messages: DemoMessage[];
  active?: DemoMessage;
  reply: string;
  onReplyChange: (v: string) => void;
  onSelect: (m: DemoMessage) => void;
  onSend: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="panel-surface overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-800">
          Gelen kutusu
        </div>
        <ul className="max-h-[480px] overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left dark:border-slate-800 ${
                  active?.id === m.id ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${m.unread ? "font-bold" : "font-medium"}`}>{m.customer}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{m.time}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{m.preview}</p>
                {m.unread && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel-surface flex min-h-[480px] flex-col">
        {active ? (
          <>
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="font-semibold">{active.customer}</p>
              <p className="text-xs text-slate-500">{active.phone} · WhatsApp</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {active.thread.map((t, i) => (
                <div
                  key={`${t.time}-${i}`}
                  className={`flex ${t.from === "customer" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      t.from === "customer"
                        ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        : t.from === "bot"
                          ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"
                          : "bg-emerald-600 text-white"
                    }`}
                  >
                    <p className="mb-1 text-[10px] font-semibold uppercase opacity-70">
                      {t.from === "customer" ? "Müşteri" : t.from === "bot" ? "Asistan" : "Siz"}
                    </p>
                    {t.text}
                    <p className="mt-1 text-[10px] opacity-60">{t.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
              <input
                value={reply}
                onChange={(e) => onReplyChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                placeholder="Yanıt yazın…"
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={onSend}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
              >
                <Send className="h-4 w-4" />
                Gönder
              </button>
            </div>
          </>
        ) : (
          <p className="m-auto text-sm text-slate-500">Sohbet seçin</p>
        )}
      </div>
    </div>
  );
}

function WorkflowView({
  columns,
  onMove,
}: {
  columns: { key: AptStatus; label: string; items: DemoAppointment[] }[];
  onMove: (id: string, status: AptStatus) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {columns.map((col) => (
          <div key={col.key} className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{col.label}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold dark:bg-slate-800">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-semibold">
                    {item.time} · {item.customer}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.service}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(["pending", "confirmed", "completed", "cancelled", "no_show"] as AptStatus[])
                      .filter((s) => s !== item.status)
                      .slice(0, 3)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onMove(item.id, s)}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium hover:bg-slate-50 dark:border-slate-600"
                        >
                          → {STATUS_LABEL[s]}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-slate-400">Boş</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrmView({
  customers,
  selected,
  query,
  onQuery,
  onSelect,
}: {
  customers: typeof DEMO_CUSTOMERS;
  selected: (typeof DEMO_CUSTOMERS)[0];
  query: string;
  onQuery: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="panel-surface p-3">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="İsim, telefon, etiket…"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <ul className="max-h-[520px] space-y-1 overflow-y-auto">
          {customers.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left ${
                  selected.id === c.id ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-slate-500">{c.phone}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">{selected.name}</h3>
            <p className="text-sm text-slate-500">{selected.phone}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.tags.map((t) => (
              <span key={t} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Ziyaret", value: selected.visits },
            { label: "Son ziyaret", value: selected.lastVisit },
            { label: "Toplam", value: `${selected.totalSpend.toLocaleString("tr-TR")} ₺` },
          ].map((s) => (
            <div key={s.label} className="panel-muted px-3 py-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-1 text-lg font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold">Personel notu</p>
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
            {selected.notes}
          </p>
        </div>
      </div>
    </div>
  );
}

function CampaignsView({
  draft,
  onDraft,
  onSend,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="panel-surface p-5">
        <h3 className="font-semibold">Yeni kampanya</h3>
        <p className="mt-1 text-sm text-slate-500">Filtre: 30+ gündür gelmeyen · 28 alıcı · WhatsApp</p>
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          rows={4}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={onSend}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
        >
          <Send className="h-4 w-4" />
          Demo gönder
        </button>
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Geçmiş gönderimler</h3>
        {DEMO_CAMPAIGNS.map((c) => (
          <article key={c.id} className="panel-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{c.title}</p>
              <span className="text-xs text-slate-500">{c.date}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{c.message}</p>
            <p className="mt-3 text-xs text-slate-500">
              {c.channel} · {c.sent}/{c.recipients} başarılı
              {c.failed > 0 ? ` · ${c.failed} başarısız` : ""}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function PricingView() {
  return (
    <div className="panel-surface overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-800">
        Hizmet kataloğu
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {DEMO_PRICING.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className={`text-sm font-semibold ${p.active ? "" : "text-slate-400 line-through"}`}>{p.name}</p>
              <p className="text-xs text-slate-500">{p.duration} dk</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{p.price.toLocaleString("tr-TR")} ₺</p>
              <p className="text-[11px] text-slate-500">{p.active ? "Aktif" : "Pasif"}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PackagesView() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {DEMO_PACKAGES.map((pk) => (
        <article key={pk.id} className="panel-surface p-5">
          <p className="text-xs font-semibold text-emerald-700">{pk.customer}</p>
          <h3 className="mt-1 font-semibold">{pk.name}</h3>
          <p className="mt-3 text-3xl font-bold tabular-nums">
            {pk.remaining}
            <span className="text-base font-medium text-slate-400">/{pk.total}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">kalan seans · bitiş {pk.expires}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${(pk.remaining / pk.total) * 100}%` }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function StaffView() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DEMO_STAFF.map((s) => (
        <article key={s.id} className="panel-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{s.name}</h3>
              <p className="text-sm text-slate-500">{s.role}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                s.off ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {s.off ? "İzinli" : "Sahada"}
            </span>
          </div>
          <p className="mt-4 text-sm">
            Bugün: <strong>{s.today}</strong> randevu
          </p>
          <p className="text-xs text-slate-500">Saatler: {s.hours}</p>
        </article>
      ))}
    </div>
  );
}

function SettingsView({
  welcomeMsg,
  onWelcome,
  onSave,
}: {
  welcomeMsg: string;
  onWelcome: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="panel-surface p-5">
        <h3 className="font-semibold">İşletme bilgisi</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Ad</dt>
            <dd className="font-medium">{DEMO_BUSINESS.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Kod</dt>
            <dd className="font-medium">{DEMO_BUSINESS.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">WhatsApp</dt>
            <dd className="font-medium">{DEMO_BUSINESS.whatsapp}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Sektör</dt>
            <dd className="font-medium">{DEMO_BUSINESS.sector}</dd>
          </div>
        </dl>
      </section>
      <section className="panel-surface p-5">
        <h3 className="font-semibold">Çalışma saatleri</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {["Pzt–Cum 09:00–19:00", "Cumartesi 10:00–18:00", "Pazar Kapalı"].map((line) => (
            <li key={line} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              {line}
            </li>
          ))}
        </ul>
      </section>
      <section className="panel-surface p-5">
        <h3 className="font-semibold">Karşılama mesajı</h3>
        <textarea
          value={welcomeMsg}
          onChange={(e) => onWelcome(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={onSave}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
        >
          Kaydet
        </button>
      </section>
      <section className="panel-surface p-5">
        <h3 className="font-semibold">Vitrin bağlantıları</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          WhatsApp kısa link ve QR kod — gerçek panelde buradan kopyalanır / indirilir.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-mono text-slate-500">
            wa.me/demo-mira
          </span>
          <span className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
            QR · Salon Mira
          </span>
        </div>
      </section>
    </div>
  );
}
