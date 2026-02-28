"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      title={isDark ? "Açık tema" : "Koyu tema"}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
        isDark ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
      }`}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          isDark ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
