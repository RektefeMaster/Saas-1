import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme-context";
import { LocaleProvider } from "@/lib/locale-context";
import { SWRProvider } from "@/app/providers/SWRProvider";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import { LoadingWrapper } from "@/components/LoadingWrapper";
import { ClientErrorBoundary } from "@/components/ClientErrorBoundary";
import "./globals.css";
import { getDefaultAppUrl } from "@/lib/app-url";

// Türkçe ğ/ş/ı/İ glifleri latin-ext alt kümesinde; onsuz bu harfler
// sistem yazı tipine düşüyordu.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  adjustFontFallback: true,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  adjustFontFallback: true,
});

// Vitrin başlıklarının karakter yüzü — tabela hissi veren geniş grotesk
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ahi AI",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
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
  const safeChildren = children ?? null;

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
        className={`${manrope.variable} ${spaceGrotesk.variable} ${bricolage.variable} antialiased`}
      >
        <ClientErrorBoundary>
          <SWRProvider>
            <ThemeProvider>
              <LocaleProvider>
                <LoadingWrapper>
                  {safeChildren}
                  <Toaster richColors position="top-right" />
                  <VercelAnalytics />
                </LoadingWrapper>
              </LocaleProvider>
            </ThemeProvider>
          </SWRProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
