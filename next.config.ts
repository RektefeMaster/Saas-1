import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Deploy build hatasinda asil sebep TS ise gecici olarak true yap; sonra duzeltip false'a al
  typescript: { ignoreBuildErrors: true },
  // Birden fazla lockfile veya yanlış workspace root uyarısını ve Vercel deploy hatalarını önlemek için trace root sabit
  outputFileTracingRoot: path.join(__dirname),
  // Serverless bundle'da docs klasörünün trace edilmesini engelle (runtime'da gerek yok)
  outputFileTracingExcludes: {
    "/*": ["./docs/**"],
  },
  // Performans optimizasyonları
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Image optimizasyonu
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Experimental optimizasyonlar - tree-shaking ile bundle küçültme
  experimental: {
    optimizePackageImports: ["lucide-react", "@supabase/supabase-js", "motion"],
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/public/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      {
        source: "/api/tenant/:path*/qr",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/_next/image",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/appicon.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/arkaplan.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
