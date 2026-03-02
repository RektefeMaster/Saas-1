"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "ahi-ai-admin-theme";
const LEGACY_STORAGE_KEY = "saasrandevu-admin-theme";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored =
      (localStorage.getItem(STORAGE_KEY) as Theme | null) ||
      (localStorage.getItem(LEGACY_STORAGE_KEY) as Theme | null);
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
      localStorage.setItem(STORAGE_KEY, stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
    localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.classList.toggle("dark", value === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
