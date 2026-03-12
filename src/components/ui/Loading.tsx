"use client";

import { useState, useContext } from "react";
import { LoadingContext } from "@/lib/loading-context";

interface LoadingProps {
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "dots" | "pulse" | "bars";
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export function Loading({
  fullScreen = true,
  size = "md",
  variant = "spinner",
  message,
  progress,
  showProgress = false,
}: LoadingProps) {
  // Global loading context'ten değerleri al (eğer varsa)
  const globalContext = useContext(LoadingContext);

  const displayMessage = message || globalContext?.message;
  const displayProgress = progress !== undefined ? progress : globalContext?.progress;
  const displayVariant = variant || globalContext?.variant || "spinner";

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-16 w-16",
  };

  const containerClasses = fullScreen
    ? "flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"
    : "flex items-center justify-center p-8";

  const renderAnimation = () => {
    switch (displayVariant) {
      case "dots":
        return (
          <div className="flex gap-2">
            <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <div className="h-3 w-3 animate-bounce rounded-full bg-primary" />
          </div>
        );

      case "pulse":
        return (
          <div className="relative">
            <div
              className={`${sizeClasses[size]} animate-pulse rounded-full bg-primary/20`}
            />
            <div
              className={`${sizeClasses[size]} absolute inset-0 animate-ping rounded-full bg-primary/40`}
            />
            <div
              className={`${sizeClasses[size]} absolute inset-0 animate-pulse rounded-full bg-primary`}
            />
          </div>
        );

      case "bars":
        return (
          <div className="flex gap-1.5">
            <div className="h-8 w-1.5 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0s]" />
            <div className="h-8 w-1.5 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.2s]" />
            <div className="h-8 w-1.5 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.4s]" />
            <div className="h-8 w-1.5 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.6s]" />
            <div className="h-8 w-1.5 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:0.8s]" />
          </div>
        );

      case "spinner":
      default:
        return (
          <div className="relative">
            <div
              className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-slate-200 border-t-primary dark:border-slate-700 dark:border-t-primary`}
            />
            <div
              className={`${sizeClasses[size]} absolute inset-0 animate-spin rounded-full border-4 border-transparent border-r-primary/30`}
              style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
            />
          </div>
        );
    }
  };

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4 w-full max-w-md px-4">
        <div className="relative">{renderAnimation()}</div>
        
        {showProgress && displayProgress !== undefined && (
          <div className="w-full max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className="text-xs text-center mt-2 text-slate-500 dark:text-slate-400">
              %{Math.round(displayProgress)}
            </p>
          </div>
        )}

        {displayMessage && (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 animate-pulse">
              {displayMessage}
            </p>
            {displayProgress !== undefined && !showProgress && (
              <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                %{Math.round(displayProgress)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Global loading state için hook - useLoadingContext'i kullan
export { useLoadingContext as useLoading } from "@/lib/loading-context";
