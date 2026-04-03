// src/app/api/health/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

function exists(value) {
  return Boolean(String(value || "").trim());
}

function envSnapshot() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: exists(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: exists(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),

    SUPABASE_URL: exists(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SECRET_KEY: exists(
      process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE
    ),

    STRIPE_SECRET_KEY: exists(process.env.STRIPE_SECRET_KEY),
    ENVIA_API_KEY: exists(process.env.ENVIA_API_KEY),
    GEMINI_API_KEY: exists(process.env.GEMINI_API_KEY),
    GEMINI_MODEL: exists(process.env.GEMINI_MODEL),
    FX_USD_TO_MXN: exists(process.env.FX_USD_TO_MXN),

    VERCEL_ENV: exists(process.env.VERCEL_ENV),
    VERCEL_URL: exists(process.env.VERCEL_URL),
    NEXT_PUBLIC_SITE_URL: exists(process.env.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_SCORESTORE_URL: exists(process.env.NEXT_PUBLIC_SCORESTORE_URL),

    // Compatibilidad con implementaciones anteriores / paneles auxiliares
    SUPABASE_SERVICE_ROLE_KEY: exists(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_SERVICE_ROLE: exists(process.env.SUPABASE_SERVICE_ROLE),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: exists(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY_ALT: exists(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}

function buildHealthPayload() {
  const env = envSnapshot();

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SECRET_KEY",
    "STRIPE_SECRET_KEY",
    "ENVIA_API_KEY",
    "GEMINI_API_KEY",
  ];

  const optional = [
    "GEMINI_MODEL",
    "FX_USD_TO_MXN",
    "VERCEL_ENV",
    "VERCEL_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SCORESTORE_URL",
  ];

  const missing = required.filter((k) => !env[k]);
  const ready = missing.length === 0;

  return {
    ok: true,
    ready,
    env,
    required,
    optional,
    missing,
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    return json(buildHealthPayload(), 200);
  } catch (e) {
    return json(
      {
        ok: false,
        error: String(e?.message || e),
      },
      500
    );
  }
}

export async function HEAD() {
  try {
    return new NextResponse(null, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch {
    return new NextResponse(null, {
      status: 500,
      headers: noStoreHeaders,
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...noStoreHeaders,
      Allow: "GET, HEAD, OPTIONS",
    },
  });
}