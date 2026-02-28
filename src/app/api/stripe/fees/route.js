// src/app/api/stripe/fees/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

const normEmail = (s) => String(s || "").trim().toLowerCase();

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

function money(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

async function getMyRole(sb, orgId, user) {
  const myEmail = normEmail(user?.email);

  const { data: mem } = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(
      `user_id.eq.${user?.id || "00000000-0000-0000-0000-000000000000"},email.ilike.${myEmail}`
    )
    .limit(1)
    .maybeSingle();

  if (!mem?.is_active) return null;
  return String(mem?.role || "").toLowerCase();
}

// FX simple (si tu Stripe opera en USD)
function fxToMXN(currency) {
  const c = String(currency || "mxn").toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return Math.max(0.0001, Number(process.env.FX_USD_TO_MXN || 18));
  const envKey = `FX_${c.toUpperCase()}_TO_MXN`;
  const fx = Number(process.env[envKey] || NaN);
  return Number.isFinite(fx) && fx > 0 ? fx : 1;
}

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  return key;
}

async function stripeGET(path, query = {}) {
  const url = new URL(`${STRIPE_API}${path}`);

  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const it of v) url.searchParams.append(k, String(it));
    else url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${stripeKey()}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message || `Stripe error (${res.status})`));
  return data;
}

async function feeFromSession(sessionId) {
  const session = await stripeGET(`/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    "expand[]": ["payment_intent.latest_charge.balance_transaction"],
  });

  const pi = session?.payment_intent;
  const piId = typeof pi === "string" ? pi : pi?.id;
  if (!piId) return { session_id: sessionId, fee_mxn: 0, fee_currency: null, fee_cents: 0 };

  const paymentIntent =
    typeof pi === "object" && pi
      ? pi
      : await stripeGET(`/payment_intents/${encodeURIComponent(piId)}`, {
          "expand[]": ["latest_charge.balance_transaction"],
        });

  const latestCharge = paymentIntent?.latest_charge;
  const chId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
  if (!chId) return { session_id: sessionId, fee_mxn: 0, fee_currency: null, fee_cents: 0 };

  const charge =
    typeof latestCharge === "object" && latestCharge
      ? latestCharge
      : await stripeGET(`/charges/${encodeURIComponent(chId)}`, {
          "expand[]": ["balance_transaction"],
        });

  const bt = charge?.balance_transaction;
  const btId = typeof bt === "string" ? bt : bt?.id;
  if (!btId) return { session_id: sessionId, fee_mxn: 0, fee_currency: null, fee_cents: 0 };

  const balanceTx =
    typeof bt === "object" && bt ? bt : await stripeGET(`/balance_transactions/${encodeURIComponent(btId)}`);

  const feeCents = Number(balanceTx?.fee || 0) || 0;
  const feeCurrency = String(balanceTx?.currency || "").toLowerCase() || null;
  const feeMXN = (feeCents / 100) * fxToMXN(feeCurrency);

  return { session_id: sessionId, fee_mxn: feeMXN, fee_currency: feeCurrency, fee_cents: feeCents };
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    const sessions = clampList(body?.stripe_session_ids, 120);

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });
    if (!sessions.length) return json(200, { ok: true, total_fee_mxn: 0, details: [] });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !hasPerm(role, "dashboard")) return json(403, { ok: false, error: "Permisos insuficientes" });

    const details = [];
    let total = 0;

    const concurrency = 5;
    for (let i = 0; i < sessions.length; i += concurrency) {
      const slice = sessions.slice(i, i + concurrency);
      const chunk = await Promise.all(
        slice.map((id) =>
          feeFromSession(id).catch(() => ({ session_id: id, fee_mxn: 0, fee_currency: null, fee_cents: 0 }))
        )
      );
      for (const d of chunk) {
        details.push(d);
        total += money(d.fee_mxn);
      }
    }

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "stripe.fees.compute",
      entity: "stripe",
      entity_id: String(sessions.length),
      summary: `Computed Stripe fees for ${sessions.length} sessions`,
      meta: { count: sessions.length },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, total_fee_mxn: total, details });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}