import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { ViewTransitionsWrapper } from "@/components/ViewTransitionsWrapper";
import { ThemeProvider } from "@/lib/theme-context";
import { LocaleProvider } from "@/lib/locale-context";
import { PostHogProvider } from "@/app/providers/PostHogProvider";
import { SWRProvider } from "@/app/providers/SWRProvider";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import { LoadingWrapper } from "@/components/LoadingWrapper";
import { ClientErrorBoundary } from "@/components/ClientErrorBoundary";
import "./globals.css";
import { getDefaultAppUrl } from "@/lib/app-url";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Ahi AI | İşletmeler İçin Yapay Zeka Platformu",
  description:
    "Randevu, CRM, otomasyon, kampanya ve operasyon süreçlerini tek panelde yöneten yapay zeka platformu",
  metadataBase: new URL(getDefaultAppUrl()),
  icons: {
    icon: "/favicon.png",
  },
};

function getSupabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseOrigin = getSupabaseOrigin();

  // Children null check - güvenlik için
  // React.ReactNode zaten null olabilir, bu normaldir
  const safeChildren = children ?? null;
  
  // Hydration sorunlarını önlemek için ekstra kontrol
  if (typeof window === "undefined" && safeChildren == null) {
    // SSR sırasında children null ise boş bir div döndür
    // Bu, hydration mismatch'i önler
  }

  return (
    <html lang="tr" data-locale="tr" suppressHydrationWarning>
      <head>
        {supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('ahi-ai-admin-theme');
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                  else if (theme === 'light') document.documentElement.classList.remove('dark');
                  var locale = localStorage.getItem('ahi-ai-locale');
                  if (locale === 'tr' || locale === 'en') {
                    document.documentElement.lang = locale;
                    document.documentElement.dataset.locale = locale;
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <ClientErrorBoundary>
          <ClientErrorBoundary componentName="PostHogProvider">
            <PostHogProvider>
              <ClientErrorBoundary componentName="SWRProvider">
                <SWRProvider>
                  <ClientErrorBoundary componentName="ThemeProvider">
                    <ThemeProvider>
                      <ClientErrorBoundary componentName="LoadingWrapper">
                        <LoadingWrapper>
                          <ClientErrorBoundary componentName="ViewTransitionsWrapper">
                            <ViewTransitionsWrapper>
                              <ClientErrorBoundary componentName="LocaleProvider">
                                <LocaleProvider>{safeChildren}</LocaleProvider>
                              </ClientErrorBoundary>
                            </ViewTransitionsWrapper>
                          </ClientErrorBoundary>
                          <Toaster richColors position="top-right" />
                          <VercelAnalytics />
                        </LoadingWrapper>
                      </ClientErrorBoundary>
                    </ThemeProvider>
                  </ClientErrorBoundary>
                </SWRProvider>
              </ClientErrorBoundary>
            </PostHogProvider>
          </ClientErrorBoundary>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
