// src/app/api/stripe/fees/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const normEmail = (s) => String(s || "").trim().toLowerCase();

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

const toMajor = (minor) => Number(minor || 0) / 100;

function fxUsdToMxn() {
  const fx = Number(process.env.FX_USD_TO_MXN || process.env.USD_TO_MXN || NaN);
  return Number.isFinite(fx) && fx > 0 ? fx : null;
}

function clampList(arr, max = 120) {
  const out = [];
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v || "").trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

async function fetchStripeSession(sessionId, stripeKey) {
  const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`);
  url.searchParams.append("expand[]", "payment_intent.latest_charge.balance_transaction");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${stripeKey}` },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  return data;
}

function extractFee(session) {
  const bt = session?.payment_intent?.latest_charge?.balance_transaction;
  const feeMinor = Number(bt?.fee || 0);
  const currency = String(bt?.currency || session?.currency || "mxn").toLowerCase();
  return { feeMinor, currency };
}

export async function POST(req) {
  try {
    const stripeKey =
      process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SK;

    if (!stripeKey) {
      return json(200, {
        ok: false,
        mode: "estimate",
        error: "STRIPE_SECRET_KEY no configurado en el servidor.",
      });
    }

    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    const sessionIds = clampList(body?.stripe_session_ids, 120);

    if (!isUuid(orgId) || sessionIds.length === 0) {
      return json(400, { ok: false, error: "org_id (uuid) y stripe_session_ids requeridos." });
    }

    // Membership check (cualquier rol activo puede ver métricas)
    const email = normEmail(user?.email);
    const { data: mem, error: memErr } = await sb
      .from("admin_users")
      .select("role,is_active")
      .eq("organization_id", orgId)
      .ilike("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (memErr) return json(500, { ok: false, error: memErr.message });
    if (!mem) return json(403, { ok: false, error: "Acceso denegado." });

    // Concurrency control
    const limit = 6;
    let idx = 0;
    const results = [];

    const worker = async () => {
      while (idx < sessionIds.length) {
        const sid = sessionIds[idx++];
        try {
          const session = await fetchStripeSession(sid, stripeKey);
          results.push({ sid, session });
        } catch (e) {
          results.push({ sid, error: String(e?.message || e) });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(limit, sessionIds.length) }, worker));

    let totalFeeMxn = 0;
    let feeUsdMinor = 0;
    let missing = 0;

    for (const r of results) {
      if (!r?.session) {
        missing += 1;
        continue;
      }
      const { feeMinor, currency } = extractFee(r.session);
      if (!feeMinor) {
        missing += 1;
        continue;
      }

      if (currency === "mxn") totalFeeMxn += toMajor(feeMinor);
      else if (currency === "usd") feeUsdMinor += feeMinor;
      else missing += 1;
    }

    const fx = fxUsdToMxn();
    const converted = Boolean(fx && feeUsdMinor);
    if (converted) totalFeeMxn += toMajor(feeUsdMinor) * fx;

    return json(200, {
      ok: true,
      mode: "stripe",
      total_fee_mxn: Number(totalFeeMxn.toFixed(2)),
      processed: sessionIds.length,
      missing,
      converted_usd: converted,
      fx_usd_to_mxn: fx || null,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}