"use client";

import { Languages, MoonStar, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useLocale } from "@/lib/locale-context";

interface ThemeLocaleSwitchProps {
  compact?: boolean;
}

export function ThemeLocaleSwitch({ compact = false }: ThemeLocaleSwitchProps) {
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useLocale();
  const isDark = theme === "dark";
  const isTr = locale === "tr";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/85 p-1 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label={isDark ? "Açık tema" : "Koyu tema"}
        title={isDark ? "Açık tema" : "Koyu tema"}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        {!compact && (isDark ? "Açık" : "Koyu")}
      </button>
      <button
        type="button"
        onClick={toggleLocale}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 font-semibold text-slate-800 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        aria-label={isTr ? "Switch to English" : "Türkçeye geç"}
        title={isTr ? "Switch to English" : "Türkçeye geç"}
      >
        <Languages className="h-4 w-4" />
        {isTr ? "TR" : "EN"}
      </button>
    </div>
  );
}
