import type { NextConfig } from "next";

// Job photos and receipts are served from the private Supabase bucket through
// short-lived signed URLs, so the browser must be allowed to load images from
// this project's own Supabase origin (and nothing else new).
const supabaseOrigin = (() => {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://ajax.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://upload.wikimedia.org${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
];

const privateNoStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
];

const internalArtworkHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Field photos/receipts are downscaled on the phone first; this leaves
    // room for a full-size receipt PDF. Stays under Vercel's 4.5MB body cap.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/internal/:path*", headers: internalArtworkHeaders },
      { source: "/sign-in", headers: privateNoStoreHeaders },
      { source: "/security/:path*", headers: privateNoStoreHeaders },
      { source: "/portal/:path*", headers: privateNoStoreHeaders },
      { source: "/agreement/:path*", headers: privateNoStoreHeaders },
    ];
  },
};

export default nextConfig;
