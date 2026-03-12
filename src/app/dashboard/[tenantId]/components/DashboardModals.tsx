"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";

const QRCodeModal = dynamic(
  () => import("@/components/ui/QRCodeModal").then((m) => ({ default: m.QRCodeModal })),
  { ssr: false, loading: () => null }
);

const WhatsAppLinkModal = dynamic(
  () => import("@/components/ui/WhatsAppLinkModal").then((m) => ({ default: m.WhatsAppLinkModal })),
  { ssr: false, loading: () => null }
);

export interface DashboardModalsHandle {
  openWhatsApp: () => void;
  openQR: () => void;
}

interface DashboardModalsProps {
  tenantId: string;
  tenantCode?: string | null;
}

export const DashboardModals = forwardRef<DashboardModalsHandle, DashboardModalsProps>(
  function DashboardModals({ tenantId, tenantCode }, ref) {
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [showQR, setShowQR] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        openWhatsApp: () => setShowWhatsApp(true),
        openQR: () => setShowQR(true),
      }),
      []
    );

    return (
      <>
        {showWhatsApp && (
          <WhatsAppLinkModal
            tenantId={tenantId}
            tenantCode={tenantCode}
            isOpen={showWhatsApp}
            onClose={() => setShowWhatsApp(false)}
          />
        )}
        {showQR && (
          <QRCodeModal
            tenantId={tenantId}
            tenantCode={tenantCode}
            isOpen={showQR}
            onClose={() => setShowQR(false)}
          />
        )}
      </>
    );
  }
);
