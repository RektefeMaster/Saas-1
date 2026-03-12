"use client";

import { useEffect, useState, useRef } from "react";

export function TopLoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const prevPathnameRef = useRef<string | null>(null);

  // Component mount kontrolü
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setMounted(true);
    // İlk mount'ta pathname'i al
    prevPathnameRef.current = window.location.pathname;
  }, []);

  useEffect(() => {
    // Mount olmamışsa veya client-side'da değilse çalışma
    if (!mounted || typeof window === "undefined") return;

    // window.location.pathname kullan (usePathname hook'u yerine)
    const currentPathname = window.location.pathname;

    // Aynı pathname ise çalışma
    if (currentPathname === prevPathnameRef.current) {
      return;
    }

    // Pathname değişti, önceki pathname'i güncelle
    prevPathnameRef.current = currentPathname;

    // Route değişikliğinde loading başlat
    setLoading(true);
    setProgress(0);

    // Simüle edilmiş progress (gerçek yükleme durumunu taklit eder)
    let currentProgress = 0;
    const interval = setInterval(() => {
      if (currentProgress >= 90) {
        clearInterval(interval);
        return;
      }
      // İlk %30 hızlı, sonra yavaşlar (daha gerçekçi)
      const increment = currentProgress < 30 ? 12 : currentProgress < 70 ? 6 : 2;
      currentProgress = Math.min(currentProgress + increment, 90);
      setProgress(currentProgress);
    }, 80);

    // Route yüklendiğinde tamamla (daha gerçekçi timing)
    const completeTimer = setTimeout(() => {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(hideTimer);
    }, 400);

    return () => {
      clearInterval(interval);
      clearTimeout(completeTimer);
    };
  }, [mounted]);

  // Pathname değişikliklerini dinle (popstate event)
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const handleLocationChange = () => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== prevPathnameRef.current) {
        prevPathnameRef.current = currentPathname;
        // Pathname değişti, loading başlat
        setLoading(true);
        setProgress(0);
      }
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, [mounted]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-300 ease-out shadow-lg shadow-primary/50"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? "width 0.2s ease-out" : "width 0.1s linear",
        }}
      >
        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}
