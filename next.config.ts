import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  // Almost every screen depends on the current time and the signed-in user
  // (countdowns, vouchers, capacity), so routes render dynamically per request
  // and stream through loading.tsx skeletons.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "web-push", "bcryptjs"],
  outputFileTracingIncludes: { "/**": ["./supabase/migrations/**"] },
  images: {
    // Set FC_IMAGES_UNOPTIMIZED=1 when the server can't reach the image hosts
    // (e.g. a sandboxed preview); browsers then load photos directly.
    unoptimized: process.env.FC_IMAGES_UNOPTIMIZED === "1",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
