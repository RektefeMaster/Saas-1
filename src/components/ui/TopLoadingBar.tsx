"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export function TopLoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // İlk render'da pathname yoksa veya aynı pathname ise çalışma
    if (!pathname || pathname === prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      return;
    }

    // Pathname değişti, önceki pathname'i güncelle
    prevPathnameRef.current = pathname;

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
  }, [pathname]);

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
