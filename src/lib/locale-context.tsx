"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const LOCALE_STORAGE_KEY = "ahi-ai-locale";

export type Locale = "tr" | "en";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "tr" || value === "en";
}

function applyLocaleToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) {
      setLocaleState(stored);
      applyLocaleToDocument(stored);
      return;
    }
    applyLocaleToDocument("tr");
  }, []);

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, value);
      applyLocaleToDocument(value);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === "tr" ? "en" : "tr";
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
        applyLocaleToDocument(next);
      }
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ locale, setLocale, toggleLocale }),
    [locale, setLocale, toggleLocale]
  );

  // React 19 uyumluluğu - null children yerine boş Fragment kullan
  const safeChildren = children ?? <></>;
  
  // Güvenli render
  try {
    return (
      <LocaleContext.Provider value={contextValue}>
        {safeChildren}
      </LocaleContext.Provider>
    );
  } catch (error) {
    console.error("[LocaleProvider] Render hatası:", error);
    return (
      <LocaleContext.Provider value={contextValue}>
        <></>
      </LocaleContext.Provider>
    );
  }
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
