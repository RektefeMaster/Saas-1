"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Building2,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Wrench,
  BarChart3,
  History,
  MessageSquareWarning,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";

const PAGES = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "İşletmeler", icon: Building2 },
  { href: "/admin/business-types", label: "İşletme Tipleri", icon: Building2 },
  { href: "/admin/campaigns", label: "Kampanyalar", icon: Megaphone },
  { href: "/admin/security", label: "Güvenlik", icon: ShieldCheck },
  { href: "/admin/conversations", label: "Konusmalar", icon: MessageSquareWarning },
  { href: "/admin/tools", label: "Araçlar", icon: Wrench },
  { href: "/admin/time-machine", label: "Time Machine", icon: History },
  { href: "/admin/langfuse", label: "LLM Gözlemi", icon: BarChart3 },
];

interface CommandMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; tenant_code: string }>>([]);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      fetch("/api/admin/tenants")
        .then((r) => {
          if (!r.ok) return [];
          return r.json();
        })
        .then((data) => setTenants(Array.isArray(data) ? data : []))
        .catch(() => setTenants([]));
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange?.(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange, open]);

  if (!mounted) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Admin komut menüsü"
      className="fixed left-1/2 top-1/4 z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400">
          <Search className="h-4 w-4" />
        </div>
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="İşletme adı veya sayfa ara..."
          className="flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
        <span className="hidden text-xs text-slate-400 sm:inline">ESC ile kapat</span>
      </div>

      <Command.List className="max-h-[320px] overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Sonuç bulunamadı.
        </Command.Empty>

        {tenants.length > 0 && (
          <Command.Group heading="İşletmeler" className="mb-2">
            {tenants.slice(0, 8).map((t) => (
              <Command.Item
                key={t.id}
                value={`${t.name} ${t.tenant_code}`}
                onSelect={() => {
                  router.push(`/admin/tenants/${t.id}`);
                  onOpenChange?.(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  "aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                )}
              >
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{t.name}</span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {t.tenant_code}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Sayfalar">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <Command.Item
                key={p.href}
                value={p.label}
                onSelect={() => {
                  router.push(p.href);
                  onOpenChange?.(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  "aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4 text-slate-400" />
                {p.label}
              </Command.Item>
            );
          })}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
