"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useState, type ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

const ContactModal = dynamic(
  () => import("@/components/ui/ContactModal").then((m) => ({ default: m.ContactModal })),
  { ssr: false, loading: () => null }
);

const SiteContactContext = createContext<() => void>(() => {});

/** SiteShell içinden iletişim modalını açar. */
export function useSiteContact() {
  return useContext(SiteContactContext);
}

interface SiteShellProps {
  children: ReactNode;
  /** Ana sayfada "#ne-yapar", diğerlerinde varsayılan "/#ne-yapar". */
  solutionsHref?: string;
}

/** Vitrin sayfalarının ortak kabuğu: header, footer, iletişim modalı. */
export function SiteShell({ children, solutionsHref }: SiteShellProps) {
  const [showContact, setShowContact] = useState(false);
  const openContact = () => setShowContact(true);

  return (
    <SiteContactContext.Provider value={openContact}>
      <div className="site-root min-h-screen">
        <SiteHeader onContact={openContact} solutionsHref={solutionsHref} />
        {children}
        <SiteFooter onContact={openContact} />
        <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      </div>
    </SiteContactContext.Provider>
  );
}
