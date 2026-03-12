"use client";

import { LoadingProvider, useLoadingContext } from "@/lib/loading-context";
import { Loading } from "@/components/ui/Loading";

function LoadingContent() {
  const { loading, message, progress, variant } = useLoadingContext();

  return (
    <>
      {/* TopLoadingBar geçici olarak devre dışı - sorun giderilene kadar */}
      {loading && (
        <Loading
          fullScreen
          variant={variant}
          size="lg"
          message={message}
          progress={progress}
          showProgress={progress !== undefined && progress > 0}
        />
      )}
    </>
  );
}

export function LoadingWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <LoadingContent />
      {children}
    </LoadingProvider>
  );
}
