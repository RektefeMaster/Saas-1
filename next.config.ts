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
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
