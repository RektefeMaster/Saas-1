import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { ViewTransitions } from "next-view-transitions";
import { ThemeProvider } from "@/lib/theme-context";
import { LocaleProvider } from "@/lib/locale-context";
import { PostHogProvider } from "@/app/providers/PostHogProvider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" data-locale="tr" suppressHydrationWarning>
      <head>
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
        <PostHogProvider>
          <ThemeProvider>
            <ViewTransitions>
              <LocaleProvider>{children}</LocaleProvider>
            </ViewTransitions>
            <Toaster richColors position="top-right" />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
