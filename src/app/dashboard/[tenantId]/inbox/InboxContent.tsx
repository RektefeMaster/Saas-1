"use client";

import { useCallback, useEffect, useState, use } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
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
    title: "Gelen Kutusu",
    empty: "Henüz konuşma yok",
    select: "Bir konuşma seçin",
    back: "Listeye dön",
    takeover: "Devral",
    resume: "AI'ya bırak",
    resolve: "Çözüldü",
    pending: "Beklemede",
    send: "Gönder",
    placeholder: "Mesaj yazın…",
    unanswered: "Cevapsız",
    handoffRate: "Aktarım",
    aiRate: "AI çözüm",
    qualityMark: "Kalite",
    summary: "Aktarım özeti",
    conflict: "Konuşma başka personelde",
    failed: "Gönderilemedi",
    markWrong: "Yanlış cevap",
    feedback: "Geri bildirim",
    moreActions: "Diğer",
    feedbackOk: "Geri bildirim kaydedildi",
    feedbackFail: "Geri bildirim kaydedilemedi",
  },
  en: {
    title: "Inbox",
    empty: "No conversations yet",
    select: "Select a conversation",
    back: "Back to list",
    takeover: "Take over",
    resume: "Return to AI",
    resolve: "Resolved",
    pending: "Pending",
    send: "Send",
    placeholder: "Type a message…",
    unanswered: "Unanswered",
    handoffRate: "Handoff",
    aiRate: "AI resolution",
    qualityMark: "Quality",
    summary: "Handoff summary",
    conflict: "Conversation owned by another agent",
    failed: "Send failed",
    markWrong: "Wrong answer",
    feedback: "Feedback",
    moreActions: "More",
    feedbackOk: "Feedback saved",
    feedbackFail: "Could not save feedback",
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

export function InboxContent({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const { locale } = useLocale();
  const t = COPY[locale === "en" ? "en" : "tr"];

  const [items, setItems] = useState<ConversationRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const [qualityTotal, setQualityTotal] = useState<number | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<string>("hallucination");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

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
      setSelected((prev) => {
        if (!prev) return prev;
        const fresh = nextItems.find((c) => c.id === prev.id);
        return fresh ? { ...prev, ...fresh } : prev;
      });
    }
    if (qualityRes.ok) {
      const q = await qualityRes.json();
      setQualityTotal(typeof q.total === "number" ? q.total : 0);
    }
  }, [tenantId]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      const res = await fetch(
        `/api/tenant/${tenantId}/conversations/${conversationId}`
      );
      if (res.status === 404 || res.status === 403) {
        setError("Erişim yok veya konuşma bulunamadı");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setSelected({ ...data.conversation, unread_count: 0 });
      setMessages(data.messages || []);
      setItems((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
      setError(null);
    },
    [tenantId]
  );

  useEffect(() => {
    const POLL_MS = 15000;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void loadList();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadList();
    };

    if (document.visibilityState === "visible") void loadList();

    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

  const clearSelection = () => {
    setSelectedId(null);
    setSelected(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setFeedbackMsg(null);
    setShowFeedback(false);
  };

  const takeover = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/tenant/${tenantId}/conversations/${selected.id}/takeover`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_version: selected.version }),
      }
    );
    setBusy(false);
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t.conflict);
      void loadThread(selected.id);
      void loadList();
      return;
    }
    if (!res.ok) {
      setError((await res.json()).error || "Hata");
      return;
    }
    const data = await res.json();
    setSelected(data.conversation);
    void loadList();
  };

  const resume = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/tenant/${tenantId}/conversations/${selected.id}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_version: selected.version }),
      }
    );
    setBusy(false);
    if (res.status === 409) {
      setError(t.conflict);
      void loadThread(selected.id);
      void loadList();
      return;
    }
    if (!res.ok) {
      setError((await res.json()).error || "Hata");
      return;
    }
    const data = await res.json();
    setSelected(data.conversation);
    void loadList();
  };

  const setStatus = async (status: "PENDING" | "RESOLVED" | "OPEN") => {
    if (!selected) return;
    const res = await fetch(
      `/api/tenant/${tenantId}/conversations/${selected.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_status: status }),
      }
    );
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data.conversation);
    void loadList();
  };

  const reportFeedback = async () => {
    if (!selected) return;
    setBusy(true);
    setFeedbackMsg(null);
    const lastAi = [...messages]
      .reverse()
      .find((m) => m.direction === "outbound" && m.sender_type === "AI");
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
    if (!res.ok) {
      setFeedbackMsg(t.feedbackFail);
      return;
    }
    setFeedbackMsg(t.feedbackOk);
    setQualityTotal((prev) => (prev == null ? 1 : prev + 1));
  };

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/tenant/${tenantId}/conversations/${selected.id}/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim() }),
      }
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t.failed);
      return;
    }
    setDraft("");
    await loadThread(selected.id);
    void loadList();
  };

  const snapshot = selected?.summary_snapshot as {
    plainSummary?: string;
    recommendedAction?: string;
    handoffSignals?: Array<{ type: string }>;
    leadScore?: number;
  } | null;

  const canCompose =
    selected?.automation_mode === "HUMAN_ACTIVE" ||
    selected?.automation_mode === "AI_ASSIST";

  const showThread = Boolean(selectedId);

  const feedbackControls = (
    <>
      <select
        value={feedbackCategory}
        onChange={(e) => setFeedbackCategory(e.target.value)}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
      >
        {FEEDBACK_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {locale === "en" ? c.labelEn : c.labelTr}
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
    <div className="flex h-[calc(100dvh-var(--dashboard-header-height)-var(--dashboard-mobile-tab-height)-env(safe-area-inset-bottom))] min-h-0 flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-6 lg:h-[calc(100dvh-var(--dashboard-header-height))] lg:min-h-[480px]">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <aside
          className={`min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
            showThread ? "hidden lg:block" : "block"
          }`}
        >
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
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
                      {c.automation_mode} · {c.conversation_status}
                      {c.priority !== "normal" ? ` · ${c.priority}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section
          className={`min-h-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
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
                    <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                      +{selected.external_user_id}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {selected.automation_mode} · v{selected.version}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void takeover()}
                    className={`${ACTION_BTN} bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100`}
                  >
                    {t.takeover}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resume()}
                    className={ACTION_BTN}
                  >
                    {t.resume}
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStatus("PENDING")}
                    className={`${ACTION_BTN} hidden sm:inline-flex`}
                  >
                    {t.pending}
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStatus("RESOLVED")}
                    className={`${ACTION_BTN} hidden sm:inline-flex`}
                  >
                    {t.resolve}
                  </button>
                  <details className="relative sm:hidden">
                    <summary
                      className={`${ACTION_BTN} list-none [&::-webkit-details-marker]:hidden`}
                    >
                      {t.moreActions}
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 flex min-w-[10rem] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => void setStatus("PENDING")}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {t.pending}
                      </button>
                      <button
                        type="button"
                        onClick={() => void setStatus("RESOLVED")}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {t.resolve}
                      </button>
                    </div>
                  </details>
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

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      m.direction === "inbound"
                        ? "bg-slate-100 dark:bg-slate-800"
                        : "ml-auto bg-emerald-600 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                    <p
                      className={`mt-1 text-[10px] opacity-70 ${
                        m.direction === "inbound" ? "" : "text-emerald-50"
                      }`}
                    >
                      {m.sender_type || m.direction}
                      {m.delivery_status ? ` · ${m.delivery_status}` : ""}
                      {m.failure_reason ? ` · ${m.failure_reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>

              {(error || feedbackMsg) && (
                <div className="shrink-0 space-y-1 px-3 sm:px-4">
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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

              <footer className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
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
                    placeholder={canCompose ? t.placeholder : t.takeover}
                    disabled={busy || !canCompose}
                    className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    disabled={busy || !draft.trim() || !canCompose}
                    onClick={() => void send()}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t.send}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
