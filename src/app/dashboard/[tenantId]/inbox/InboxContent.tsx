"use client";

import { useCallback, useEffect, useState, use } from "react";
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
    takeover: "Devral",
    resume: "AI'ya bırak",
    resolve: "Çözüldü",
    pending: "Beklemede",
    send: "Gönder",
    placeholder: "Mesaj yazın…",
    unanswered: "Cevapsız",
    handoffRate: "İnsan aktarım",
    aiRate: "AI çözüm",
    summary: "Aktarım özeti",
    conflict: "Konuşma başka personelde",
    failed: "Gönderilemedi",
    markWrong: "Yanlış cevap",
    feedbackOk: "Geri bildirim kaydedildi",
    feedbackFail: "Geri bildirim kaydedilemedi",
  },
  en: {
    title: "Inbox",
    empty: "No conversations yet",
    takeover: "Take over",
    resume: "Return to AI",
    resolve: "Resolved",
    pending: "Pending",
    send: "Send",
    placeholder: "Type a message…",
    unanswered: "Unanswered",
    handoffRate: "Handoff rate",
    aiRate: "AI resolution",
    summary: "Handoff summary",
    conflict: "Conversation owned by another agent",
    failed: "Send failed",
    markWrong: "Wrong answer",
    feedbackOk: "Feedback saved",
    feedbackFail: "Could not save feedback",
  },
} as const;

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
      // Keep selected.version fresh so takeover/resume don't false-409.
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
    void loadList();
    const timer = setInterval(() => void loadList(), 15000);
    return () => clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

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

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t.title}
        </h1>
        {metrics && (
          <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span>
              {t.unanswered}: <strong>{metrics.unanswered_open}</strong>
            </span>
            <span>
              {t.handoffRate}:{" "}
              <strong>{Math.round(metrics.human_handoff_rate * 100)}%</strong>
            </span>
            <span>
              {t.aiRate}:{" "}
              <strong>{Math.round(metrics.ai_resolution_rate * 100)}%</strong>
            </span>
            {qualityTotal != null && (
              <span>
                AI kalite işaret: <strong>{qualityTotal}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full flex-col gap-1 px-3 py-3 text-left text-sm transition-colors ${
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

        <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {!selected ? (
            <p className="m-auto p-6 text-sm text-slate-500">{t.empty}</p>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="mr-auto">
                  <div className="font-medium">+{selected.external_user_id}</div>
                  <div className="text-xs text-slate-500">
                    {selected.automation_mode} · v{selected.version}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void takeover()}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  {t.takeover}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resume()}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  {t.resume}
                </button>
                <button
                  type="button"
                  onClick={() => void setStatus("PENDING")}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  {t.pending}
                </button>
                <button
                  type="button"
                  onClick={() => void setStatus("RESOLVED")}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  {t.resolve}
                </button>
              </header>

              {snapshot && (snapshot.plainSummary || snapshot.recommendedAction) && (
                <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="font-medium text-amber-900 dark:text-amber-200">
                    {t.summary}
                  </div>
                  {snapshot.plainSummary && <p>{snapshot.plainSummary}</p>}
                  {snapshot.recommendedAction && (
                    <p className="text-amber-800 dark:text-amber-300">
                      → {snapshot.recommendedAction}
                    </p>
                  )}
                  {snapshot.leadScore != null && (
                    <p className="text-xs">Lead: {snapshot.leadScore}</p>
                  )}
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      m.direction === "inbound"
                        ? "bg-slate-100 dark:bg-slate-800"
                        : "ml-auto bg-emerald-600 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.message_text}</p>
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

              {error && (
                <p className="px-4 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {feedbackMsg && (
                <p className="px-4 text-sm text-slate-600 dark:text-slate-300">
                  {feedbackMsg}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
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
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {t.markWrong}
                </button>
              </div>

              <footer className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={
                    selected.automation_mode === "HUMAN_ACTIVE" ||
                    selected.automation_mode === "AI_ASSIST"
                      ? t.placeholder
                      : t.takeover
                  }
                  disabled={
                    busy ||
                    (selected.automation_mode !== "HUMAN_ACTIVE" &&
                      selected.automation_mode !== "AI_ASSIST")
                  }
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="button"
                  disabled={
                    busy ||
                    !draft.trim() ||
                    (selected.automation_mode !== "HUMAN_ACTIVE" &&
                      selected.automation_mode !== "AI_ASSIST")
                  }
                  onClick={() => void send()}
                  className="rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t.send}
                </button>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
