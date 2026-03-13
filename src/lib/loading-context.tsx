"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface LoadingState {
  loading: boolean;
  message?: string;
  progress?: number;
  variant?: "spinner" | "dots" | "pulse" | "bars";
}

interface LoadingContextType {
  loading: boolean;
  message?: string;
  progress?: number;
  variant: "spinner" | "dots" | "pulse" | "bars";
  startLoading: (message?: string, variant?: LoadingState["variant"]) => void;
  stopLoading: () => void;
  setProgress: (progress: number) => void;
  setMessage: (message: string) => void;
}

export const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadingState>({
    loading: false,
    variant: "spinner",
  });

  const startLoading = useCallback(
    (message?: string, variant: LoadingState["variant"] = "spinner") => {
      setState({
        loading: true,
        message,
        variant,
        progress: 0,
      });
    },
    []
  );

  const stopLoading = useCallback(() => {
    setState((prev) => ({
      ...prev,
      loading: false,
      progress: 100,
    }));
    // Progress'i sıfırla
    setTimeout(() => {
      setState({
        loading: false,
        variant: "spinner",
      });
    }, 300);
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  }, []);

  const setMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      message,
    }));
  }, []);

  // React 19 uyumluluğu - null children yerine boş Fragment kullan
  const safeChildren = children ?? <></>;
  
  // Güvenli render
  try {
    return (
      <LoadingContext.Provider
        value={{
          loading: state.loading,
          message: state.message,
          progress: state.progress,
          variant: state.variant || "spinner",
          startLoading,
          stopLoading,
          setProgress,
          setMessage,
        }}
      >
        {safeChildren}
      </LoadingContext.Provider>
    );
  } catch (error) {
    console.error("[LoadingProvider] Render hatası:", error);
    return (
      <LoadingContext.Provider
        value={{
          loading: false,
          variant: "spinner",
          startLoading,
          stopLoading,
          setProgress,
          setMessage,
        }}
      >
        <></>
      </LoadingContext.Provider>
    );
  }
}

export function useLoadingContext() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoadingContext must be used within a LoadingProvider");
  }
  return context;
}
