/** @type {import('next').NextConfig} */

const FALLBACK_SUPABASE_HOST = "lpbzndnavkbpxwnlbqgb.supabase.co";
const FALLBACK_SCORESTORE_HOST = "scorestore.vercel.app"; // Migrado a Vercel

function supabaseHost() {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!u) return FALLBACK_SUPABASE_HOST;
    return new URL(u).hostname || FALLBACK_SUPABASE_HOST;
  } catch {
    return FALLBACK_SUPABASE_HOST;
  }
}

const SUPABASE_HOST = supabaseHost();

function scorestoreHost() {
  try {
    const u = process.env.NEXT_PUBLIC_SCORESTORE_URL || process.env.SCORESTORE_URL;
    if (!u) return FALLBACK_SCORESTORE_HOST;
    return new URL(u).hostname || FALLBACK_SCORESTORE_HOST;
  } catch {
    return FALLBACK_SCORESTORE_HOST;
  }
}

const SCORESTORE_HOST = scorestoreHost();

// CSP robusto adaptado para Vercel (permite imágenes de deployments de preview de Vercel)
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `img-src 'self' data: blob: https://${SUPABASE_HOST} https://${SCORESTORE_HOST} https://*.vercel.app`,
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://generativelanguage.googleapis.com https://api.stripe.com`,
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
];

const htmlHeaders = [
  ...securityHeaders,
  { key: "Content-Type", value: "text/html; charset=utf-8" },
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig = {
  output: "standalone", // Vercel soporta standalone perfectamente
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: SUPABASE_HOST },
      { protocol: "https", hostname: SCORESTORE_HOST },
      { protocol: "https", hostname: "vercel.app" }, // Permite dominios genéricos de Vercel si es necesario
    ],
  },
  async headers() {
    return [
      { source: "/", headers: htmlHeaders },
      { source: "/auth/callback", headers: htmlHeaders },
      { source: "/scorestore-settings", headers: htmlHeaders },
      { source: "/:path((?!_next/|api/|.*\\..*).*)", headers: htmlHeaders },
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/offline.html",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Content-Type", value: "text/html; charset=utf-8" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
