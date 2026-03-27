export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * Health sin auth y sin Supabase.
 * Útil para verificar que Vercel, envs y secretos ya están listos.
 */
export async function GET() {
  try {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ),
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SECRET_KEY: Boolean(
        process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
      ENVIA_API_KEY: Boolean(process.env.ENVIA_API_KEY),
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      GEMINI_MODEL: Boolean(process.env.GEMINI_MODEL),
      FX_USD_TO_MXN: Boolean(process.env.FX_USD_TO_MXN),
      VERCEL_ENV: Boolean(process.env.VERCEL_ENV),
      VERCEL_URL: Boolean(process.env.VERCEL_URL),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      NEXT_PUBLIC_SCORESTORE_URL: Boolean(process.env.NEXT_PUBLIC_SCORESTORE_URL),
    };

    return NextResponse.json(
      { ok: true, env },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}