import { NextResponse } from "next/server";

// UnicOs — middleware de seguridad compatible con Vercel.
// No inyecta CSP aquí para evitar conflicto con el CSP de next.config.js
// y para no romper estilos inline / UI del panel.

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

export function middleware() {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-192.png|icon-512.png|.*\\..*).*)",
  ],
};