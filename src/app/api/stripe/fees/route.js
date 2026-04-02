// src/app/api/stripe/fees/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

const STRIPE_API = "https://api.stripe.com/v1";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (status, payload) =>
  NextResponse.json(payload, { status, headers: noStoreHeaders });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clampInt(v, min, max, fallback = min) {
  const n = Math.floor(safeNum(v, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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

function normalizeEmail(v) {
  return normEmail(v).trim().toLowerCase();
}

function fxToMXN(currency) {
  const c = String(currency || "mxn").toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return Math.max(0.0001, Number(process.env.FX_USD_TO_MXN || 18));

  const envKey = `FX_${c.toUpperCase()}_TO_MXN`;
  const fx = Number(process.env[envKey] || NaN);
  return Number.isFinite(fx) && fx > 0 ? fx : 1;
}

function getStripeKey() {
  const key = safeStr(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  return key;
}

async function stripeGET(path, query = {}) {
  const url = new URL(`${STRIPE_API}${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const it of v) url.searchParams.append(k, String(it));
    } else {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getStripeKey()}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error?.message || `Stripe error (${res.status})`));
  }

  return data;
}

async function feeFromSession(sessionId) {
  const session = await stripeGET(`/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    "expand[]": ["payment_intent.latest_charge.balance_transaction"],
  });

  const pi = session?.payment_intent;
  const piId = typeof pi === "string" ? pi : pi?.id;
  if (!piId) {
    return {
      session_id: sessionId,
      fee_mxn: 0,
      fee_currency: null,
      fee_cents: 0,
      payment_intent_id: null,
      charge_id: null,
      balance_transaction_id: null,
    };
  }

  const paymentIntent =
    typeof pi === "object" && pi
      ? pi
      : await stripeGET(`/payment_intents/${encodeURIComponent(piId)}`, {
          "expand[]": ["latest_charge.balance_transaction"],
        });

  const latestCharge = paymentIntent?.latest_charge;
  const chId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
  if (!chId) {
    return {
      session_id: sessionId,
      fee_mxn: 0,
      fee_currency: null,
      fee_cents: 0,
      payment_intent_id: piId,
      charge_id: null,
      balance_transaction_id: null,
    };
  }

  const charge =
    typeof latestCharge === "object" && latestCharge
      ? latestCharge
      : await stripeGET(`/charges/${encodeURIComponent(chId)}`, {
          "expand[]": ["balance_transaction"],
        });

  const bt = charge?.balance_transaction;
  const btId = typeof bt === "string" ? bt : bt?.id;
  if (!btId) {
    return {
      session_id: sessionId,
      fee_mxn: 0,
      fee_currency: null,
      fee_cents: 0,
      payment_intent_id: piId,
      charge_id: chId,
      balance_transaction_id: null,
    };
  }

  const balanceTx =
    typeof bt === "object" && bt
      ? bt
      : await stripeGET(`/balance_transactions/${encodeURIComponent(btId)}`);

  const feeCents = Number(balanceTx?.fee || 0) || 0;
  const feeCurrency = String(balanceTx?.currency || "").toLowerCase() || null;
  const feeMXN = (feeCents / 100) * fxToMXN(feeCurrency);

  return {
    session_id: sessionId,
    fee_mxn: Number.isFinite(feeMXN) ? feeMXN : 0,
    fee_currency: feeCurrency,
    fee_cents: feeCents,
    payment_intent_id: piId,
    charge_id: chId,
    balance_transaction_id: btId,
  };
}

async function resolveOrgId(sb, explicitOrgId = "") {
  const explicit = safeStr(explicitOrgId).trim();
  if (isUuid(explicit)) return explicit;

  const envId = safeStr(process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID || "").trim();
  if (isUuid(envId)) return envId;

  try {
    const { data: bySlug } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", "score-store")
      .limit(1)
      .maybeSingle();

    if (bySlug?.id) return bySlug.id;

    const { data: byName } = await sb
      .from("organizations")
      .select("id")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName?.id) return byName.id;

    const { data: anyOrg } = await sb
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (anyOrg?.id) return anyOrg.id;
  } catch {}

  return "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "dashboard")) {
    return { ok: false, res: json(403, { ok: false, error: "Permisos insuficientes" }) };
  }

  return { ok: true, user, role };
}

function normalizeSessionsInput(body = {}, reqUrl = null) {
  const fromBody =
    body?.stripe_session_ids ||
    body?.session_ids ||
    body?.sessions ||
    body?.ids ||
    [];

  const fromQuery = reqUrl
    ? reqUrl.searchParams.getAll("stripe_session_ids").length
      ? reqUrl.searchParams.getAll("stripe_session_ids")
      : safeStr(reqUrl.searchParams.get("stripe_session_ids") || "").split(",")
    : [];

  const list = Array.isArray(fromBody) && fromBody.length ? fromBody : fromQuery;
  return clampList(list, 120);
}

function parseOrgId(body = {}, reqUrl = null) {
  const fromBody = safeStr(body?.org_id || body?.organization_id || body?.orgId || "").trim();
  if (fromBody) return fromBody;

  const fromQuery = reqUrl
    ? safeStr(reqUrl.searchParams.get("org_id") || reqUrl.searchParams.get("orgId") || "").trim()
    : "";

  return fromQuery;
}

async function computeFeesForSessions(sessions, concurrency = 5) {
  const details = [];
  let total_fee_mxn = 0;

  for (let i = 0; i < sessions.length; i += concurrency) {
    const slice = sessions.slice(i, i + concurrency);
    const chunk = await Promise.all(
      slice.map((id) =>
        feeFromSession(id).catch(() => ({
          session_id: id,
          fee_mxn: 0,
          fee_currency: null,
          fee_cents: 0,
          payment_intent_id: null,
          charge_id: null,
          balance_transaction_id: null,
          error: "stripe_lookup_failed",
        }))
      )
    );

    for (const item of chunk) {
      details.push(item);
      total_fee_mxn += safeNum(item?.fee_mxn, 0);
    }
  }

  return {
    total_fee_mxn: Math.round(total_fee_mxn * 100) / 100,
    details,
  };
}

async function handle(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));

    const orgId = parseOrgId(body, url);
    const sessions = normalizeSessionsInput(body, url);
    const concurrency = clampInt(body?.concurrency ?? url.searchParams.get("concurrency"), 1, 10, 5);

    if (!isUuid(orgId)) {
      return json(400, { ok: false, error: "org_id inválido" });
    }

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    if (!sessions.length) {
      return json(200, {
        ok: true,
        org_id: orgId,
        count: 0,
        total_fee_mxn: 0,
        details: [],
      });
    }

    const { total_fee_mxn, details } = await computeFeesForSessions(sessions, concurrency);

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "stripe.fees.compute",
      entity: "stripe",
      entity_id: String(sessions.length),
      summary: `Computed Stripe fees for ${sessions.length} sessions`,
      meta: {
        count: sessions.length,
        concurrency,
        total_fee_mxn,
        role: auth.role,
        source: "api/stripe/fees",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, {
      ok: true,
      org_id: orgId,
      count: sessions.length,
      total_fee_mxn,
      details,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function GET(req) {
  return handle(req);
}

export async function POST(req) {
  return handle(req);
}

export async function PATCH(req) {
  return handle(req);
}