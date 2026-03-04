"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type ConversationSummary = {
  tenant_id: string;
  customer_phone_digits: string;
  tenant_name: string | null;
  tenant_code: string | null;
  last_message_at: string;
  last_message_text?: string | null;
  last_inbound_text: string | null;
  last_outbound_text: string | null;
  message_count: number;
  inbound_count: number;
  outbound_count: number;
  paused_for_human: boolean;
  admin_takeover_active: boolean;
  pause_reason: string | null;
};

type MessageItem = {
  id: number;
  direction: "inbound" | "outbound" | "system";
  message_text: string | null;
  message_type: string | null;
  stage: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 2000;
const MESSAGES_POLL_MS = 2000;

function formatDate(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Az önce";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} dk`;
  if (diff < 86400_000) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("90") && phone.length >= 10) {
    return `+90 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

export default function AdminConversationsPage() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [limit, setLimit] = useState(80);
  const [tenantFilter, setTenantFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const fetchList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          hours: String(hours),
          limit: String(limit),
        });
        if (tenantFilter.trim()) params.set("tenant_id", tenantFilter.trim());
        if (phoneFilter.trim()) params.set("phone", phoneFilter.trim());

        const res = await fetch(`/api/admin/conversations/list?${params}`, {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as
          | { items?: ConversationSummary[] }
          | { error?: string }
          | null;

        if (!res.ok) {
          throw new Error(
            payload && "error" in payload ? payload.error : "Liste alinamadi"
          );
        }
        const data = payload as { items: ConversationSummary[] };
        const newItems = Array.isArray(data.items) ? data.items : [];
        setItems(newItems);
        const sel = selectedRef.current;
        if (sel) {
          const updated = newItems.find(
            (i) =>
              i.tenant_id === sel.tenant_id &&
              i.customer_phone_digits === sel.customer_phone_digits
          );
          if (updated) setSelected(updated);
          else setSelected(null);
        }
      } catch (err) {
        setItems([]);
        if (!silent) toast.error("Liste alınamadı", err instanceof Error ? err.message : undefined);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [hours, limit, tenantFilter, phoneFilter]
  );

  const fetchMessages = useCallback(
    async (conv: ConversationSummary, silent = false) => {
      if (!silent) setMessagesLoading(true);
      try {
        const params = new URLSearchParams({
          tenant_id: conv.tenant_id,
          phone: conv.customer_phone_digits,
          hours: String(hours),
          limit: "200",
        });
        const res = await fetch(
          `/api/admin/conversations/messages?${params}`,
          { cache: "no-store" }
        );
        const payload = (await res.json().catch(() => null)) as
          | { items?: MessageItem[] }
          | { error?: string }
          | null;

        if (!res.ok) {
          throw new Error(
            payload && "error" in payload ? payload.error : "Mesajlar alinamadi"
          );
        }
        const data = payload as { items: MessageItem[] };
        setMessages(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        setMessages([]);
        if (!silent) toast.error("Mesajlar alınamadı", err instanceof Error ? err.message : undefined);
      } finally {
        if (!silent) setMessagesLoading(false);
      }
    },
    [hours]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    pollRef.current = setInterval(() => fetchList(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchList]);

  useEffect(() => {
    if (selected) {
      fetchMessages(selected);
      messagesPollRef.current = setInterval(() => {
        if (selectedRef.current) fetchMessages(selectedRef.current, true);
      }, MESSAGES_POLL_MS);
    } else {
      if (messagesPollRef.current) {
        clearInterval(messagesPollRef.current);
        messagesPollRef.current = null;
      }
      setMessages([]);
    }
    return () => {
      if (messagesPollRef.current) {
        clearInterval(messagesPollRef.current);
        messagesPollRef.current = null;
      }
    };
  }, [selected, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runAction = useCallback(
    async (
      key: string,
      fn: () => Promise<void>,
      onSuccess?: () => void,
      onError?: () => void
    ) => {
      setActionLoading(key);
      try {
        await fn();
        onSuccess?.();
        await fetchList(true);
        if (selected) await fetchMessages(selected, true);
        toast.success("İşlem başarılı");
      } catch (err) {
        onError?.();
        toast.error(
          "İşlem başarısız",
          err instanceof Error ? err.message : String(err)
        );
      } finally {
        setActionLoading(null);
      }
    },
    [fetchList, fetchMessages, selected]
  );

  const handleTakeover = useCallback(
    () =>
      selected &&
      runAction(`takeover:${selected.tenant_id}:${selected.customer_phone_digits}`, async () => {
        const res = await fetch("/api/admin/conversations/takeover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: selected.tenant_id,
            customer_phone: selected.customer_phone_digits,
            actor: "admin_ui",
          }),
        });
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(p?.error || "Takeover basarisiz");
      }),
    [selected, runAction]
  );

  const handleResume = useCallback(
    () =>
      selected &&
      runAction(`resume:${selected.tenant_id}:${selected.customer_phone_digits}`, async () => {
        const res = await fetch("/api/admin/conversations/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: selected.tenant_id,
            customer_phone: selected.customer_phone_digits,
            actor: "admin_ui",
          }),
        });
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(p?.error || "Resume basarisiz");
      }),
    [selected, runAction]
  );

  const handleSend = useCallback(
    () =>
      selected &&
      draft.trim() &&
      (() => {
        const text = draft.trim();
        const tempId = -Date.now();
        setDraft("");
        setMessages((prev) => [
          ...prev,
          {
            id: tempId,
            direction: "outbound" as const,
            message_text: text,
            message_type: "text",
            stage: "admin_takeover_manual_send",
            created_at: new Date().toISOString(),
          },
        ]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        runAction(
          `send:${selected.tenant_id}:${selected.customer_phone_digits}`,
          async () => {
            const res = await fetch("/api/admin/conversations/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenant_id: selected.tenant_id,
                customer_phone: selected.customer_phone_digits,
                text,
                actor: "admin_ui",
              }),
            });
            const p = (await res.json().catch(() => null)) as { error?: string } | null;
            if (!res.ok) throw new Error(p?.error || "Mesaj gonderilemedi");
          },
          () => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          },
          () => {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          }
        );
      })(),
    [selected, draft, runAction]
  );

  const actionKey = selected
    ? `${selected.tenant_id}:${selected.customer_phone_digits}`
    : "";
  const canSend =
    selected?.admin_takeover_active && draft.trim().length > 0;

  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        const name = (item.tenant_name || "").toLowerCase();
        const code = (item.tenant_code || "").toLowerCase();
        const phone = item.customer_phone_digits;
        const last = (
          item.last_message_text ||
          item.last_inbound_text ||
          item.last_outbound_text ||
          ""
        ).toLowerCase();
        return name.includes(q) || code.includes(q) || phone.includes(q) || last.includes(q);
      })
    : items;

  const takeoverCount = items.filter((i) => i.admin_takeover_active).length;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-0 lg:h-[calc(100vh-6rem)]">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              WhatsApp Konuşmalar
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Anlik ({POLL_INTERVAL_MS / 1000}s)
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Tüm konuşmaları anlık izleyin, takeover ile müdahale edin
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
            <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {items.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">konuşma</span>
          </div>
          {takeoverCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/30">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {takeoverCount}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400">takeover</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => fetchList()}
            disabled={loading}
            aria-label="Listeyi yenile"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Yenile
          </button>
        </div>
      </header>

      {/* Main content */}
      <section className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Sol: Konusma listesi */}
        <aside className="flex w-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-[380px]">
          {/* Arama */}
          <div className="border-b border-slate-200 p-3 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="İşletme, telefon veya mesaj ara..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Filtreler */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtreler
                </span>
                <span className="text-xs text-slate-500">
                  {hours}h {tenantFilter || phoneFilter ? "• Aktif" : ""}
                </span>
              </button>
              {filterOpen && (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50/30 p-3 dark:border-slate-700 dark:bg-slate-800/30">
                  <label className="block">
                    <span className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Son saat
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={hours}
                      onChange={(e) =>
                        setHours(Math.min(168, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Tenant ID
                    </span>
                    <input
                      value={tenantFilter}
                      onChange={(e) => setTenantFilter(e.target.value)}
                      placeholder="Opsiyonel"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Telefon
                    </span>
                    <input
                      value={phoneFilter}
                      onChange={(e) => setPhoneFilter(e.target.value)}
                      placeholder="90555..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
                  <MessageSquare className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {searchQuery ? "Arama sonucu yok" : `Son ${hours} saatte konusma yok`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {searchQuery ? "Farkli bir arama deneyin" : "Yeni mesajlar burada gorunecek"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const key = `${item.tenant_id}:${item.customer_phone_digits}`;
                  const isSelected =
                    selected?.tenant_id === item.tenant_id &&
                    selected?.customer_phone_digits === item.customer_phone_digits;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelected(item)}
                      className={cn(
                        "flex w-full items-start gap-3 p-4 text-left transition",
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {item.tenant_name || "Bilinmeyen"}
                          </p>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatDate(item.last_message_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {formatPhone(item.customer_phone_digits)}
                          {item.tenant_code && (
                            <span className="ml-1 font-mono text-slate-400">
                              • {item.tenant_code}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                          {item.last_message_text ||
                            item.last_inbound_text ||
                            item.last_outbound_text ||
                            "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.admin_takeover_active && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                              <Zap className="h-3 w-3" />
                              Takeover
                            </span>
                          )}
                          {item.paused_for_human && !item.admin_takeover_active && (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                              Paused
                            </span>
                          )}
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {item.message_count} mesaj
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Sag: Mesajlar */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 dark:border-slate-700">
                <MessageSquare className="mx-auto h-14 w-14 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                  Konuşma seçin
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Soldaki listeden bir konuşma seçerek mesajları görüntüleyin
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {selected.tenant_name || "Bilinmeyen"}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {formatPhone(selected.customer_phone_digits)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.admin_takeover_active ? (
                    <button
                      type="button"
                      onClick={handleResume}
                      disabled={Boolean(actionLoading)}
                      aria-label="Botu tekrar devreye al"
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {actionLoading === `resume:${actionKey}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      Botu Devam Ettir
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTakeover}
                      disabled={Boolean(actionLoading)}
                      aria-label="Botu durdur ve manuel mesajlaş"
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
                    >
                      {actionLoading === `takeover:${actionKey}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                      Takeover
                    </button>
                  )}
                  {selected.admin_takeover_active && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Manuel mod
                    </span>
                  )}
                </div>
              </div>

              {/* Mesajlar */}
              <div className="flex-1 overflow-y-auto p-4">
                {messagesLoading ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Mesajlar yükleniyor...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
                    <Clock className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Mesaj bulunamadı</p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-2xl space-y-4">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex gap-3",
                          m.direction === "inbound" ? "flex-row" : "flex-row-reverse"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            m.direction === "inbound"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                              : m.direction === "outbound"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                          )}
                        >
                          {m.direction === "inbound" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm",
                            m.direction === "inbound"
                              ? "rounded-tl-md bg-white dark:bg-slate-800"
                              : m.direction === "outbound"
                                ? "rounded-tr-md bg-emerald-100 dark:bg-emerald-900/40"
                                : "rounded-tl-md bg-amber-50 dark:bg-amber-950/30"
                          )}
                        >
                          <p className="break-words text-sm text-slate-900 dark:text-slate-100">
                            {m.message_text || "—"}
                          </p>
                          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {formatTime(m.created_at)}
                            {m.stage && (
                              <span className="ml-2 text-slate-400">• {m.stage}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Mesaj gonder */}
              {selected.admin_takeover_active && (
                <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mx-auto flex max-w-2xl gap-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Müşteriye mesaj yazın... (Enter ile gönder)"
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={!canSend || Boolean(actionLoading)}
                      onClick={handleSend}
                      aria-label="Mesajı gönder"
                      title={!canSend ? "Mesaj yazın" : undefined}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600"
                    >
                      {actionLoading === `send:${actionKey}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Gönder
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </section>
    </div>
  );
}
