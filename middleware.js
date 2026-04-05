import { NextResponse } from 'next/server';

// Configuración de Hosts extraída de tu middleware original
const FALLBACK_SUPABASE_HOST = 'lpbzndnavkbpxwnlbqgb.supabase.co';
const FALLBACK_SCORESTORE_HOST = 'scorestore.vercel.app';

function supabaseHost() {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!u) return FALLBACK_SUPABASE_HOST;
    return new URL(u).hostname || FALLBACK_SUPABASE_HOST;
  } catch {
    return FALLBACK_SUPABASE_HOST;
  }
}

function scorestoreHost() {
  try {
    const u = process.env.NEXT_PUBLIC_SCORESTORE_URL || process.env.SCORESTORE_URL;
    if (!u) return FALLBACK_SCORESTORE_HOST;
    return new URL(u).hostname || FALLBACK_SCORESTORE_HOST;
  } catch {
    return FALLBACK_SCORESTORE_HOST;
  }
}

const SUPABASE_HOST = supabaseHost();
const SCORESTORE_HOST = scorestoreHost();

export function middleware(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // CORRECCIÓN: Inyección de CSP respetando tus dominios configurados
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: ${SUPABASE_HOST} https://*.stripe.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' https://${SUPABASE_HOST} https://${SCORESTORE_HOST} https://api.stripe.com https://api.envia.com;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
