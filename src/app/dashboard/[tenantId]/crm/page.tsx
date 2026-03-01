"use client";

import { useEffect, useState } from "react";
import { Plus, BellPlus } from "lucide-react";

interface CrmCustomer {
  customer_phone: string;
  customer_name: string | null;
  tags: string[];
  notes_summary: string | null;
  last_visit_at: string | null;
  total_visits: number;
}

interface CrmNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
}

interface CrmReminder {
  id: string;
  customer_phone: string;
  title: string;
  remind_at: string;
  channel: "panel" | "whatsapp" | "both";
  status: "pending" | "sent" | "cancelled";
}

export default function CrmPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [reminders, setReminders] = useState<CrmReminder[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [reminderForm, setReminderForm] = useState({
    title: "",
    remind_at: "",
    channel: "both" as "panel" | "whatsapp" | "both",
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const loadCustomers = async () => {
    if (!tenantId) return;
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/customers?q=${encodeURIComponent(search)}`);
    const data = (await res.json().catch(() => [])) as CrmCustomer[];
    setCustomers(Array.isArray(data) ? data : []);
  };

  const loadReminders = async () => {
    if (!tenantId) return;
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/reminders`);
    const data = (await res.json().catch(() => [])) as CrmReminder[];
    setReminders(Array.isArray(data) ? data : []);
  };

  const loadCustomerDetail = async (phone: string) => {
    if (!tenantId || !phone) return;
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(phone)}`);
    const payload = (await res.json().catch(() => ({}))) as {
      customer?: CrmCustomer;
      notes?: CrmNote[];
    };
    setSelectedCustomer((payload.customer || null) as CrmCustomer | null);
    setNotes(Array.isArray(payload.notes) ? payload.notes : []);
  };

  useEffect(() => {
    loadCustomers();
    loadReminders();
  }, [tenantId, search]);

  useEffect(() => {
    if (!selectedPhone) return;
    loadCustomerDetail(selectedPhone);
  }, [selectedPhone]);

  const addNote = async () => {
    if (!tenantId || !selectedPhone || !newNote.trim()) return;
    await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote.trim(), created_by: "dashboard" }),
    });
    setNewNote("");
    await loadCustomerDetail(selectedPhone);
    await loadCustomers();
  };

  const addTag = async () => {
    if (!tenantId || !selectedPhone || !selectedCustomer || !newTag.trim()) return;
    const nextTags = [...new Set([...(selectedCustomer.tags || []), newTag.trim()])];
    await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
    setNewTag("");
    await loadCustomerDetail(selectedPhone);
    await loadCustomers();
  };

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedPhone || !reminderForm.title || !reminderForm.remind_at) return;
    await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_phone: selectedPhone,
        title: reminderForm.title,
        remind_at: reminderForm.remind_at,
        channel: reminderForm.channel,
      }),
    });
    setReminderForm({ title: "", remind_at: "", channel: "both" });
    await loadReminders();
  };

  const setReminderStatus = async (id: string, status: "pending" | "sent" | "cancelled") => {
    await fetch(`${baseUrl}/api/tenant/${tenantId}/crm/reminders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await loadReminders();
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          CRM Defteri
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Müşteri kartları, notlar ve hatırlatma akışlarını yönetin.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Telefon veya isim ara..."
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <div className="space-y-2">
            {customers.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">Kayıt bulunamadı.</p>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.customer_phone}
                  type="button"
                  onClick={() => setSelectedPhone(customer.customer_phone)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    selectedPhone === customer.customer_phone
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900">
                    {customer.customer_name || customer.customer_phone}
                  </p>
                  <p className="text-xs text-slate-500">{customer.customer_phone}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{customer.total_visits} ziyaret</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!selectedPhone ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              Soldan bir müşteri seçin.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedCustomer?.customer_name || selectedPhone}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{selectedPhone}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedCustomer?.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Etiket ekle"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="mr-1 inline h-3.5 w-3.5" />
                    Ekle
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold text-slate-900">Notlar</h3>
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <p className="text-sm text-slate-500">Henüz not yok.</p>
                  ) : (
                    notes.map((note) => (
                      <article key={note.id} className="rounded-xl border border-slate-100 px-3 py-2">
                        <p className="text-sm text-slate-800">{note.note}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {new Date(note.created_at).toLocaleString("tr-TR")}
                        </p>
                      </article>
                    ))
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Yeni not..."
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addNote}
                    className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Kaydet
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold text-slate-900">Hatırlatma oluştur</h3>
                <form onSubmit={createReminder} className="grid gap-2 md:grid-cols-3">
                  <input
                    value={reminderForm.title}
                    onChange={(e) => setReminderForm((s) => ({ ...s, title: e.target.value }))}
                    placeholder="Hatırlatma başlığı"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="datetime-local"
                    value={reminderForm.remind_at}
                    onChange={(e) => setReminderForm((s) => ({ ...s, remind_at: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                  <select
                    value={reminderForm.channel}
                    onChange={(e) =>
                      setReminderForm((s) => ({
                        ...s,
                        channel: e.target.value as "panel" | "whatsapp" | "both",
                      }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="both">Panel + WhatsApp</option>
                    <option value="panel">Sadece panel</option>
                    <option value="whatsapp">Sadece WhatsApp</option>
                  </select>
                  <button
                    type="submit"
                    className="md:col-span-3 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <BellPlus className="h-4 w-4" />
                    Hatırlatma Ekle
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">Yaklaşan CRM Hatırlatmaları</h3>
        {reminders.length === 0 ? (
          <p className="text-sm text-slate-500">Hatırlatma yok.</p>
        ) : (
          <div className="space-y-2">
            {reminders.map((reminder) => (
              <article
                key={reminder.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{reminder.title}</p>
                  <p className="text-xs text-slate-500">
                    {reminder.customer_phone} •{" "}
                    {new Date(reminder.remind_at).toLocaleString("tr-TR")} • {reminder.channel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{reminder.status}</span>
                  <button
                    type="button"
                    onClick={() => setReminderStatus(reminder.id, "sent")}
                    className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700"
                  >
                    Gönderildi
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderStatus(reminder.id, "cancelled")}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700"
                  >
                    İptal
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
