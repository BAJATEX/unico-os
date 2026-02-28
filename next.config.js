/** @type {import('next').NextConfig} */

// UnicOs — Next config (seguro + Lighthouse-friendly)

const FALLBACK_SUPABASE_HOST = "lpbzndnavkbpxwnlbqgb.supabase.co";

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

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `img-src 'self' data: blob: https://${SUPABASE_HOST}`,
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

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: SUPABASE_HOST }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;