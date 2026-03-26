// middleware.js — UnicOs CSP STRICT + Nonce (Migrado a Vercel)
// Docs: Next.js Middleware + CSP Nonces
// - Genera nonce por request
// - Inserta Content-Security-Policy ENFORCEMENT
// - Next auto-aplica el nonce a scripts internos cuando el page es dinámico

import { NextResponse } from "next/server";

export function middleware(request) {
  // Nonce impredecible por request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // CSP estricta (XSS-hardening) + allow Supabase + allow Vercel Previews
  // Nota: en DEV Next/React puede requerir 'unsafe-eval' por debugging; en PROD no.
  const cspHeader = `
    default-src 'self';
    base-uri 'self';
    object-src 'none';
    frame-ancestors 'none';
    form-action 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data: https://*.supabase.co https://*.vercel.app;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    font-src 'self' data:;
    worker-src 'self' blob:;
    manifest-src 'self';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Pasamos nonce a la app vía header (Next puede leerlo)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // CSP enforcement en respuesta
  response.headers.set("Content-Security-Policy", cspHeader);

  // Security baseline (sin X-XSS-Protection porque es legacy)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  return response;
}

// IMPORTANT: no aplicar Middleware a API, estáticos, imágenes optimizadas, SW, manifest, icons
export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-192.png|icon-512.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
