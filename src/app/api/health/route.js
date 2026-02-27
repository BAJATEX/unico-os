// src/app/api/health/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { error } = await requireUserFromToken(sb, token);
    if (error) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

    return NextResponse.json(
      {
        ok: true,
        env: {
          SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
          GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),

          STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
          ENVIA_API_KEY: Boolean(process.env.ENVIA_API_KEY),

          FX_USD_TO_MXN: Boolean(process.env.FX_USD_TO_MXN),
        },
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Error interno", detail: String(e?.message || e) }, { status: 500 });
  }
}