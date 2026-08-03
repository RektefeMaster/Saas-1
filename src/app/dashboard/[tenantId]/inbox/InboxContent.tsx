"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { ArrowLeft, Bot, ChevronDown, ChevronUp, UserRound } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { VirtualList } from "@/components/ui/VirtualList";
import type { ConversationRow } from "@/types/conversation.types";

type MessageRow = {
  id: string;
  direction: string;
  message_text: string | null;
  delivery_status: string | null;
  sender_type: string | null;
  created_at: string;
  failure_reason?: string | null;
};

type Metrics = {
  unanswered_open: number;
  human_handoff_rate: number;
  ai_resolution_rate: number;
  open_count: number;
  resolved_count: number;
};

const COPY = {
  tr: {
    title: "Gelen kutusu",
    empty: "Henüz konuşma yok",
    noMessages: "Bu konuşmada henüz mesaj yok",
    select: "Bir konuşma seçin",
    back: "Listeye dön",
    takeover: "Devral",
    resume: "Asistana bırak",
    resolve: "Çözüldü",
    pending: "Beklemeye al",
    send: "Gönder",
    placeholder: "Mesaj yazın…",
    needTakeover: "Önce konuşmayı devralın",
    unanswered: "Cevapsız",
    handoffRate: "Aktarım",
    aiRate: "Asistan çözüm",
    qualityMark: "Kalite",
    summary: "Aktarım özeti",
    conflict: "Konuşma başka personelde — liste yenilendi, tekrar deneyin",
    failed: "Gönderilemedi",
    accessDenied: "Erişim yok veya konuşma bulunamadı",
    genericError: "Bir hata oluştu",
    markWrong: "Yanlış cevap",
    feedback: "Geri bildirim",
    moreActions: "Diğer",
    feedbackOk: "Geri bildirim kaydedildi",
    feedbackFail: "Geri bildirim kaydedilemedi",
    you: "Siz",
    customer: "Müşteri",
    ai: "Asistan",
    system: "Sistem",
    modeAi: "Asistan yanıtlıyor",
    modeHuman: "Siz yönetiyorsunuz",
    modePaused: "Beklemede",
    modeAssist: "Asistan yardımcı",
    takeoverOk: "Konuşma sizde — yazabilirsiniz",
    resumeOk: "Asistan devam ediyor",
    pendingOk: "Beklemeye alındı",
    resolveOk: "Çözüldü olarak işaretlendi",
    statusPending: "beklemede",
    statusResolved: "çözüldü",
    deliveryQueued: "kuyrukta",
    deliverySent: "gönderildi",
    deliveryDelivered: "iletildi",
    deliveryRead: "okundu",
    deliveryFailed: "başarısız",
  },
  en: {
    title: "Inbox",
    empty: "No conversations yet",
    noMessages: "No messages in this conversation yet",
    select: "Select a conversation",
    back: "Back to list",
    takeover: "Take over",
    resume: "Return to AI",
    resolve: "Resolved",
    pending: "Mark pending",
    send: "Send",
    placeholder: "Type a message…",
    needTakeover: "Take over the conversation first",
    unanswered: "Unanswered",
    handoffRate: "Handoff",
    aiRate: "AI resolution",
    qualityMark: "Quality",
    summary: "Handoff summary",
    conflict: "Owned by another agent — refreshed, try again",
    failed: "Send failed",
    accessDenied: "No access or conversation not found",
    genericError: "Something went wrong",
    markWrong: "Wrong answer",
    feedback: "Feedback",
    moreActions: "More",
    feedbackOk: "Feedback saved",
    feedbackFail: "Could not save feedback",
    you: "You",
    customer: "Customer",
    ai: "AI",
    system: "System",
    modeAi: "AI responding",
    modeHuman: "You are in control",
    modePaused: "Waiting",
    modeAssist: "AI assist",
    takeoverOk: "Taken over — you can type",
    resumeOk: "Returned to AI",
    pendingOk: "Marked as pending",
    resolveOk: "Marked resolved",
    statusPending: "pending",
    statusResolved: "resolved",
    deliveryQueued: "queued",
    deliverySent: "sent",
    deliveryDelivered: "delivered",
    deliveryRead: "read",
    deliveryFailed: "failed",
  },
} as const;

const ACTION_BTN =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800";

const FEEDBACK_CATEGORIES = [
  { value: "wrong_price", labelTr: "Yanlış fiyat", labelEn: "Wrong price" },
  { value: "wrong_availability", labelTr: "Yanlış müsaitlik", labelEn: "Wrong availability" },
  { value: "hallucination", labelTr: "Uydurma bilgi", labelEn: "Hallucination" },
  { value: "unsafe_health_claim", labelTr: "Sağlık iddiası", labelEn: "Unsafe health claim" },
  { value: "wrong_policy", labelTr: "Yanlış politika", labelEn: "Wrong policy" },
  { value: "tone_issue", labelTr: "Ton sorunu", labelEn: "Tone issue" },
  { value: "failed_handoff", labelTr: "Aktarım hatası", labelEn: "Failed handoff" },
  { value: "wrong_customer_context", labelTr: "Yanlış müşteri bağlamı", labelEn: "Wrong context" },
  { value: "other", labelTr: "Diğer", labelEn: "Other" },
] as const;

function isInbound(direction: string | null | undefined): boolean {
  const d = (direction || "").toLowerCase();
  return d === "inbound" || d === "in" || d === "customer";
}

function isSystemMessage(
  direction: string | null | undefined,
  senderType: string | null | undefined
): boolean {
  const d = (direction || "").toLowerCase();
  const s = (senderType || "").toUpperCase();
  return d === "system" || s === "SYSTEM";
}

function isAiSender(senderType: string | null | undefined): boolean {
  const s = (senderType || "").toUpperCase();
  return s === "AI" || s === "BOT";
}

function deliveryLabel(
  status: string | null | undefined,
  t: (typeof COPY)[keyof typeof COPY]
): string {
  if (!status) return "";
  switch (status.toLowerCase()) {
    case "queued":
      return t.deliveryQueued;
    case "sent":
      return t.deliverySent;
    case "delivered":
      return t.deliveryDelivered;
    case "read":
      return t.deliveryRead;
    case "failed":
      return t.deliveryFailed;
    default:
      return status;
  }
}

function formatMsgTime(iso: string, locale: "tr" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeLabel(
  mode: string | null | undefined,
  labels: { modeHuman: string; modeAssist: string; modePaused: string; modeAi: string }
): string {
  switch (mode) {
    case "HUMAN_ACTIVE":
      return labels.modeHuman;
    case "AI_ASSIST":
      return labels.modeAssist;
    case "AUTOMATION_PAUSED":
      return labels.modePaused;
    default:
      return labels.modeAi;
  }
}

export function InboxContent({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const { locale } = useLocale();
  const lang = locale === "en" ? "en" : "tr";
  const t = COPY[lang];

  const [items, setItems] = useState<ConversationRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [qualityTotal, setQualityTotal] = useState<number | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<string>("hallucination");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<ConversationRow | null>(null);
  const messageCountRef = useRef(0);
  const threadReqRef = useRef(0);
  const busyRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const loadList = useCallback(async () => {
    const [res, qualityRes] = await Promise.all([
      fetch(`/api/tenant/${tenantId}/conversations?metrics=1&limit=80`),
      fetch(`/api/tenant/${tenantId}/quality?days=30`),
    ]);
    if (res.ok) {
      const data = await res.json();
      const nextItems = (data.items || []) as ConversationRow[];
      setItems(nextItems);
      setMetrics(data.metrics || null);
      // Never overwrite a newer local conversation with a stale list row.
      setSelected((prev) => {
        if (!prev) return prev;
        const fresh = nextItems.find((c) => c.id === prev.id);
        if (!fresh) return prev;
        if ((fresh.version ?? 0) < (prev.version ?? 0)) return prev;
        return { ...prev, ...fresh };
      });
    }
    if (qualityRes.ok) {
      const q = await qualityRes.json();
      setQualityTotal(typeof q.total === "number" ? q.total : 0);
    }
  }, [tenantId]);

  const loadThread = useCallback(
    async (conversationId: string, opts?: { clearError?: boolean }) => {
      const reqId = ++threadReqRef.current;
      const res = await fetch(
        `/api/tenant/${tenantId}/conversations/${conversationId}`
      );
      // Drop stale responses after the user switched threads.
      if (reqId !== threadReqRef.current) return null;
      if (selectedIdRef.current && selectedIdRef.current !== conversationId) {
        return null;
      }
      if (res.status === 404 || res.status === 403) {
        setError(t.accessDenied);
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (reqId !== threadReqRef.current) return null;
      const conversation = {
        ...data.conversation,
        unread_count: 0,
      } as ConversationRow;
      setSelected((prev) => {
        if (prev && prev.id === conversation.id && (prev.version ?? 0) > (conversation.version ?? 0)) {
          return prev;
        }
        return conversation;
      });
      setMessages((data.messages || []) as MessageRow[]);
      setItems((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
      if (opts?.clearError !== false) setError(null);
      return conversation;
    },
    [tenantId, t.accessDenied]
  );

  useEffect(() => {
    const POLL_MS = 15000;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      // Avoid clobbering in-flight takeover/send with a poll refresh.
      if (busyRef.current) return;
      void loadList();
      const id = selectedIdRef.current;
      if (id) void loadThread(id, { clearError: false });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    if (document.visibilityState === "visible") void loadList();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadList, loadThread]);

  useEffect(() => {
    messageCountRef.current = 0;
    setMessages([]);
    setDraft("");
    setInfo(null);
    setFeedbackMsg(null);
    if (selectedId) void loadThread(selectedId, { clearError: true });
  }, [selectedId, loadThread]);

  useEffect(() => {
    const prevCount = messageCountRef.current;
    const grew = messages.length > prevCount;
    const initialLoad = prevCount === 0 && messages.length > 0;
    messageCountRef.current = messages.length;
    if (grew || initialLoad) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const clearSelection = () => {
    setSelectedId(null);
    setSelected(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setInfo(null);
    setFeedbackMsg(null);
    setShowFeedback(false);
  };

  const withFreshVersion = async (
    action: (conversationId: string, version: number) => Promise<Response>,
    onOk: (conversation: ConversationRow) => void
  ) => {
    const current = selectedRef.current;
    if (!current || busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
    setError(null);
    setInfo(null);

    const conversationId = current.id;
    let version = current.version;
    let res = await action(conversationId, version);

    if (res.status === 409) {
      const fresh = await loadThread(conversationId, { clearError: false });
      if (fresh) {
        version = fresh.version;
        res = await action(conversationId, version);
      }
    }

    setBusy(false);
    busyRef.current = false;

    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t.conflict);
      void loadThread(conversationId, { clearError: false });
      void loadList();
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t.genericError);
      return;
    }
    const data = await res.json();
    const conversation = data.conversation as ConversationRow;
    if (selectedIdRef.current === conversationId) {
      setSelected(conversation);
      onOk(conversation);
    }
    void loadList();
  };

  const takeover = () =>
    void withFreshVersion(
      (conversationId, expected_version) =>
        fetch(`/api/tenant/${tenantId}/conversations/${conversationId}/takeover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expected_version }),
        }),
      () => setInfo(t.takeoverOk)
    );

  const resume = () =>
    void withFreshVersion(
      (conversationId, expected_version) =>
        fetch(`/api/tenant/${tenantId}/conversations/${conversationId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expected_version }),
        }),
      () => setInfo(t.resumeOk)
    );

  const markPending = () =>
    void withFreshVersion(
      (conversationId, expected_version) =>
        fetch(`/api/tenant/${tenantId}/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            automation_mode: "AUTOMATION_PAUSED",
            conversation_status: "PENDING",
            expected_version,
          }),
        }),
      () => setInfo(t.pendingOk)
    );

  const markResolved = () =>
    void withFreshVersion(
      (conversationId, expected_version) =>
        fetch(`/api/tenant/${tenantId}/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_status: "RESOLVED",
            expected_version,
          }),
        }),
      () => setInfo(t.resolveOk)
    );

  const reportFeedback = async () => {
    if (!selected || busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
    setFeedbackMsg(null);
    const lastAi = [...messages]
      .reverse()
      .find(
        (m) =>
          !isInbound(m.direction) &&
          !isSystemMessage(m.direction, m.sender_type) &&
          isAiSender(m.sender_type)
      );
    const res = await fetch(
      `/api/tenant/${tenantId}/conversations/${selected.id}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: feedbackCategory,
          message_id: lastAi?.id,
        }),
      }
    );
    setBusy(false);
    busyRef.current = false;
    if (!res.ok) {
      setFeedbackMsg(t.feedbackFail);
      return;
    }
    setFeedbackMsg(t.feedbackOk);
    setQualityTotal((prev) => (prev == null ? 1 : prev + 1));
  };

  const send = async () => {
    const current = selectedRef.current;
    const text = draft.trim();
    if (!current || !text || busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
    setError(null);
    const res = await fetch(
      `/api/tenant/${tenantId}/conversations/${current.id}/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }
    );
    setBusy(false);
    busyRef.current = false;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t.failed);
      if (res.status === 409) void loadThread(current.id, { clearError: false });
      return;
    }
    setDraft("");
    await loadThread(current.id, { clearError: true });
    void loadList();
  };

  const snapshot = selected?.summary_snapshot as {
    plainSummary?: string;
    recommendedAction?: string;
    leadScore?: number;
  } | null;

  const canCompose =
    selected?.automation_mode === "HUMAN_ACTIVE" ||
    selected?.automation_mode === "AI_ASSIST";
  const showThread = Boolean(selectedId);
  const mode = selected?.automation_mode;
  const isHuman = mode === "HUMAN_ACTIVE" || mode === "AI_ASSIST";
  const isPaused = mode === "AUTOMATION_PAUSED";
  const isAi = !isHuman && !isPaused;

  const feedbackControls = (
    <>
      <select
        value={feedbackCategory}
        onChange={(e) => setFeedbackCategory(e.target.value)}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
      >
        {FEEDBACK_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {lang === "en" ? c.labelEn : c.labelTr}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => void reportFeedback()}
        className={`${ACTION_BTN} shrink-0 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100`}
      >
        {t.markWrong}
      </button>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-var(--dashboard-header-height)-var(--dashboard-mobile-tab-height)-env(safe-area-inset-bottom))] min-h-0 flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-6 lg:h-[calc(100dvh-var(--dashboard-header-height))]">
      <div
        className={`shrink-0 items-end justify-between gap-3 ${
          showThread ? "hidden lg:flex" : "flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        }`}
      >
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100">
          {t.title}
        </h1>
        {metrics && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t.unanswered}: <strong>{metrics.unanswered_open}</strong>
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t.handoffRate}:{" "}
              <strong>{Math.round(metrics.human_handoff_rate * 100)}%</strong>
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t.aiRate}:{" "}
              <strong>{Math.round(metrics.ai_resolution_rate * 100)}%</strong>
            </span>
            {qualityTotal != null && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {t.qualityMark}: <strong>{qualityTotal}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        <aside
          className={`min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
            showThread ? "hidden lg:block" : "block"
          }`}
        >
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{t.empty}</p>
          ) : (
            <VirtualList
              items={items}
              height={560}
              estimateSize={88}
              className="divide-y divide-slate-100 dark:divide-slate-800"
              renderItem={(c) => (
                <button
                  type="button"
                  onClick={() => {
                    setInfo(null);
                    setError(null);
                    setSelectedId(c.id);
                  }}
                  className={`flex min-h-[4.5rem] w-full flex-col gap-1 px-3 py-3 text-left text-sm transition-colors active:bg-slate-50 dark:active:bg-slate-800 ${
                    selectedId === c.id
                      ? "bg-emerald-50 dark:bg-emerald-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      +{c.external_user_id}
                    </span>
                    {c.unread_count > 0 && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-slate-500">
                    {c.last_message_preview || "—"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {modeLabel(c.automation_mode, t)}
                    {c.conversation_status === "PENDING" ? ` · ${t.statusPending}` : ""}
                    {c.conversation_status === "RESOLVED" ? ` · ${t.statusResolved}` : ""}
                  </span>
                </button>
              )}
            />
          )}
        </aside>

        <section
          className={`min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
            showThread ? "flex" : "hidden lg:flex"
          }`}
        >
          {!selected ? (
            <p className="m-auto p-6 text-sm text-slate-500">
              {showThread ? "…" : t.select}
            </p>
          ) : (
            <>
              <header className="shrink-0 border-b border-slate-100 px-3 py-3 dark:border-slate-800 sm:px-4">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label={t.back}
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      +{selected.external_user_id}
                    </div>
                    <div
                      className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isHuman
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : isPaused
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {modeLabel(mode, t)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(isAi || isPaused) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={takeover}
                      className={`${ACTION_BTN} border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500`}
                    >
                      {t.takeover}
                    </button>
                  )}
                  {(isHuman || isPaused) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={resume}
                      className={ACTION_BTN}
                    >
                      {t.resume}
                    </button>
                  )}
                  {(isAi || isHuman) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={markPending}
                      className={ACTION_BTN}
                    >
                      {t.pending}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void markResolved()}
                    className={ACTION_BTN}
                  >
                    {t.resolve}
                  </button>
                </div>
              </header>

              {snapshot && (snapshot.plainSummary || snapshot.recommendedAction) && (
                <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="font-medium text-amber-900 dark:text-amber-200">
                    {t.summary}
                  </div>
                  {snapshot.plainSummary && (
                    <p className="mt-1 break-words text-amber-950 dark:text-amber-100">
                      {snapshot.plainSummary}
                    </p>
                  )}
                  {snapshot.recommendedAction && (
                    <p className="mt-1 text-amber-800 dark:text-amber-300">
                      → {snapshot.recommendedAction}
                    </p>
                  )}
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/80 px-3 py-4 dark:bg-slate-950/40 sm:px-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    {t.noMessages}
                  </p>
                ) : (
                  messages.map((m) => {
                    if (isSystemMessage(m.direction, m.sender_type)) {
                      return (
                        <div key={m.id} className="flex w-full justify-center px-2">
                          <p className="max-w-[min(92%,28rem)] rounded-full bg-slate-200/80 px-3 py-1.5 text-center text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <span className="font-medium">{t.system}</span>
                            {m.message_text ? ` · ${m.message_text}` : ""}
                          </p>
                        </div>
                      );
                    }
                    const inbound = isInbound(m.direction);
                    const fromAi = !inbound && isAiSender(m.sender_type);
                    const label = inbound ? t.customer : fromAi ? t.ai : t.you;
                    const delivery = deliveryLabel(m.delivery_status, t);
                    return (
                      <div
                        key={m.id}
                        className={`flex w-full gap-2 ${inbound ? "justify-start" : "justify-end"}`}
                      >
                        {inbound && (
                          <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            <UserRound className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        <div
                          className={`max-w-[min(85%,28rem)] ${inbound ? "items-start" : "items-end"} flex flex-col`}
                        >
                          <span className="mb-1 px-1 text-[11px] font-medium text-slate-500">
                            {label}
                          </span>
                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                              inbound
                                ? "rounded-tl-md border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                : fromAi
                                  ? "rounded-tr-md bg-slate-800 text-white dark:bg-slate-700"
                                  : "rounded-tr-md bg-emerald-600 text-white"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {m.message_text}
                            </p>
                          </div>
                          <p
                            className={`mt-1 px-1 text-[10px] text-slate-400 ${inbound ? "" : "text-right"}`}
                          >
                            {formatMsgTime(m.created_at, lang)}
                            {delivery ? ` · ${delivery}` : ""}
                            {m.failure_reason ? ` · ${m.failure_reason}` : ""}
                          </p>
                        </div>
                        {!inbound && (
                          <span
                            className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              fromAi
                                ? "bg-slate-800 text-white dark:bg-slate-600"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            }`}
                          >
                            {fromAi ? (
                              <Bot className="h-4 w-4" aria-hidden />
                            ) : (
                              <UserRound className="h-4 w-4" aria-hidden />
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {(error || info || feedbackMsg) && (
                <div className="shrink-0 space-y-1 px-3 sm:px-4">
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  )}
                  {info && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      {info}
                    </p>
                  )}
                  {feedbackMsg && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {feedbackMsg}
                    </p>
                  )}
                </div>
              )}

              <div className="hidden shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 lg:flex dark:border-slate-800">
                {feedbackControls}
              </div>

              <div className="shrink-0 border-t border-slate-100 lg:hidden dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFeedback((v) => !v)}
                  className="flex min-h-11 w-full items-center justify-between px-3 text-sm text-slate-600 dark:text-slate-300"
                  aria-expanded={showFeedback}
                >
                  <span>{t.feedback}</span>
                  {showFeedback ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
                  )}
                </button>
                {showFeedback && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                    {feedbackControls}
                  </div>
                )}
              </div>

              <footer className="dashboard-sticky-cta sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/95 p-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={canCompose ? t.placeholder : t.needTakeover}
                    disabled={busy || !canCompose}
                    className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    disabled={busy || !draft.trim() || !canCompose}
                    onClick={() => void send()}
                    className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t.send}
                  </button>
                </div>
                {!canCompose && (
                  <p className="mt-2 text-xs text-slate-500">
                    {t.needTakeover}
                  </p>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
