"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use} from "react";
import { ArrowLeft, BookPlus, Check, Archive, Pencil, X } from "lucide-react";

// tenantKnowledge.service.ts'teki KNOWLEDGE_BODY_PROMPT_CHARS ile aynı olmalı.
// Servis service-role Supabase istemcisi taşıdığı için client bundle'a import edilemez.
const PROMPT_CHARS = 400;

const CATEGORIES = [
  { value: "faq", label: "Sık Sorulan" },
  { value: "policy", label: "Politika" },
  { value: "campaign", label: "Kampanya" },
  { value: "other", label: "Diğer" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  approved: "Onaylı",
  archived: "Arşiv",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

interface KnowledgeEntry {
  id: string;
  title: string;
  body: string;
  category: string;
  status: "draft" | "approved" | "archived";
  version: number;
  effective_from: string | null;
  effective_until: string | null;
  approved_at: string | null;
  updated_at: string;
}

const EMPTY_FORM = {
  title: "",
  body: "",
  category: "faq",
  effective_from: "",
  effective_until: "",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** `<input type="date">` yalnızca YYYY-MM-DD kabul eder; saat dilimi kayması olmadan çevir. */
function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const inputClass =
  "w-full min-h-11 rounded-lg border border-slate-200 px-3 py-3 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function KnowledgePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [maxApproved, setMaxApproved] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [warning, setWarning] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { tenantId } = use(params);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError("");

    const res = await fetch(`/api/tenant/${tenantId}/knowledge?status=all`, {
      cache: "no-store",
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload?.error || "Bilgi kayıtları alınamadı.");
      setEntries([]);
      setLoading(false);
      return;
    }

    setEntries(Array.isArray(payload.entries) ? payload.entries : []);
    setApprovedCount(payload.approvedCount ?? 0);
    setMaxApproved(payload.max_approved ?? 15);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      body: entry.body,
      category: entry.category,
      effective_from: toDateInputValue(entry.effective_from),
      effective_until: toDateInputValue(entry.effective_until),
    });
    setInfo("");
    setError("");
    setWarning("");
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !form.title.trim() || !form.body.trim()) return;

    setSaving(true);
    setError("");
    setInfo("");
    setWarning("");

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      effective_from: form.effective_from || null,
      effective_until: form.effective_until || null,
      ...(editingId ? { id: editingId } : {}),
    };

    const res = await fetch(`/api/tenant/${tenantId}/knowledge`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(result?.error || "Kayıt kaydedilemedi.");
      return;
    }

    setInfo(editingId ? "Kayıt güncellendi." : "Taslak oluşturuldu. Bot henüz kullanmıyor.");
    if (result?.warning) setWarning(result.warning);
    resetForm();
    await loadData();
  };

  const changeStatus = async (entry: KnowledgeEntry, status: KnowledgeEntry["status"]) => {
    if (!tenantId) return;
    setSaving(true);
    setError("");
    setInfo("");
    setWarning("");

    const res = await fetch(`/api/tenant/${tenantId}/knowledge`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status }),
    });
    const result = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(result?.error || "Durum güncellenemedi.");
      return;
    }

    setInfo(
      status === "approved"
        ? "Onaylandı. Bot bu bilgiyi kullanmaya başladı."
        : status === "archived"
          ? "Arşivlendi. Bot artık kullanmıyor."
          : "Taslağa alındı. Bot artık kullanmıyor."
    );
    if (result?.warning) setWarning(result.warning);
    await loadData();
  };

  const bodyChars = form.body.trim().length;
  const approvedFull = approvedCount >= maxApproved;

  return (
    <div className="space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-10">
      <header className="panel-surface p-5 sm:p-6">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Panele dön
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Bilgi bankası
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          Sık sorulan cevapları buraya yazın. Asistan yalnızca <strong>onayladığınız</strong> metinleri
          kullanır. Fiyat yazmayın — fiyatlar hizmet listesinden gelir.
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Onaylı kayıt: {approvedCount}/{maxApproved}
        </p>
        {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p>}
        {info && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{info}</p>}
        {warning && (
          <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">{warning}</p>
        )}
      </header>

      <section className="panel-surface p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {editingId ? "Kaydı düzenle" : "Yeni bilgi"}
        </h2>
        <form onSubmit={submitForm} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="kb-title" className={labelClass}>
                Başlık
              </label>
              <input
                id="kb-title"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Örn: Otopark var mı?"
                maxLength={120}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="kb-category" className={labelClass}>
                Kategori
              </label>
              <select
                id="kb-category"
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="kb-body" className={labelClass}>
              Metin
            </label>
            <textarea
              id="kb-body"
              value={form.body}
              onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
              placeholder="Botun müşteriye vereceği cevap."
              rows={4}
              maxLength={2000}
              className={`${inputClass} min-h-28`}
              required
            />
            <p
              className={`mt-1 text-xs ${
                bodyChars > PROMPT_CHARS
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {bodyChars} karakter
              {bodyChars > PROMPT_CHARS
                ? ` — bot yalnızca ilk ${PROMPT_CHARS} karakteri okur.`
                : ` / bot ilk ${PROMPT_CHARS} karakteri okur`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="kb-from" className={labelClass}>
                Geçerlilik başlangıcı (opsiyonel)
              </label>
              <input
                id="kb-from"
                type="date"
                value={form.effective_from}
                onChange={(e) => setForm((s) => ({ ...s, effective_from: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="kb-until" className={labelClass}>
                Geçerlilik bitişi (opsiyonel)
              </label>
              <input
                id="kb-until"
                type="date"
                value={form.effective_until}
                onChange={(e) => setForm((s) => ({ ...s, effective_until: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <BookPlus className="h-4 w-4" />
              {editingId ? "Değişikliği Kaydet" : "Taslak Olarak Ekle"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
                Vazgeç
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel-surface p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Kayıtlar</h2>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">Yükleniyor…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Henüz kayıt yok. İlk sorulardan başlayın: otopark, iptal politikası, yaş sınırı.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      STATUS_STYLES[entry.status] || STATUS_STYLES.draft
                    }`}
                  >
                    {STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {CATEGORIES.find((c) => c.value === entry.category)?.label || entry.category} · v
                    {entry.version} · {formatDate(entry.updated_at)}
                  </span>
                </div>

                <p className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{entry.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {entry.body}
                </p>

                {(entry.effective_from || entry.effective_until) && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Geçerlilik: {formatDate(entry.effective_from)} → {formatDate(entry.effective_until)}
                  </p>
                )}

                {entry.status !== "approved" && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Bot bunu henüz kullanmıyor.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Düzenle
                  </button>

                  {entry.status !== "approved" ? (
                    <button
                      type="button"
                      onClick={() => changeStatus(entry, "approved")}
                      disabled={saving || approvedFull}
                      title={
                        approvedFull
                          ? `En fazla ${maxApproved} onaylı kayıt olabilir. Önce birini arşivleyin.`
                          : undefined
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Onayla
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => changeStatus(entry, "draft")}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                      <X className="h-3.5 w-3.5" />
                      Yayından Kaldır
                    </button>
                  )}

                  {entry.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => changeStatus(entry, "archived")}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Arşivle
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
