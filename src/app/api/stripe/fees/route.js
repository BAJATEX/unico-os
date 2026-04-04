// src/app/api/stripe/fees/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const FX_USD_TO_MXN = Number(process.env.FX_USD_TO_MXN || process.env.USD_MXN || "18");

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

function normalizeEmail(v) {
  return normEmail(v).trim().toLowerCase();
}

function parseOrgId(body = {}, url = null) {
  const fromBody = safeStr(body?.org_id || body?.organization_id || body?.orgId || "").trim();
  if (fromBody) return fromBody;

  const fromQuery = url
    ? safeStr(url.searchParams.get("org_id") || url.searchParams.get("orgId") || "").trim()
    : "";

  return fromQuery;
}

function parseCurrency(value) {
  const c = safeStr(value || "mxn").trim().toLowerCase();
  if (!c) return "mxn";
  if (c === "usd" || c === "mxn") return c;
  return c;
}

function parseSessionsInput(body = {}, url = null) {
  const raw =
    (Array.isArray(body?.sessions) && body.sessions) ||
    (Array.isArray(body?.items) && body.items) ||
    (Array.isArray(body?.data) && body.data) ||
    [];

  const q = url?.searchParams?.get("sessions") || "";
  if (!raw.length && q) {
    return q
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((id) => ({ session_id: id }));
  }

  return raw
    .map((item) => ({
      session_id: safeStr(item?.session_id || item?.checkout_session_id || item?.stripe_session_id || item?.id || "").trim(),
      payment_intent_id: safeStr(item?.payment_intent_id || item?.paymentIntentId || item?.payment_intent || "").trim(),
      currency: parseCurrency(item?.currency || item?.currency_code || "mxn"),
      amount_total_cents: Math.max(0, Math.round(safeNum(item?.amount_total_cents || item?.total_cents || item?.amount || 0))),
      fee_percent: Math.max(0, safeNum(item?.fee_percent || item?.stripe_fee_percent || 0)),
      fee_fixed_mxn: Math.max(0, safeNum(item?.fee_fixed_mxn || item?.fixed_fee_mxn || 0)),
    }))
    .filter((x) => x.session_id || x.payment_intent_id);
}

function fxToMXN(currency) {
  const c = safeStr(currency || "mxn").toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return Math.max(0.0001, FX_USD_TO_MXN);
  const envKey = `FX_${c.toUpperCase()}_TO_MXN`;
  const fx = Number(process.env[envKey] || NaN);
  return Number.isFinite(fx) && fx > 0 ? fx : 1;
}

function stripeClient() {
  if (!STRIPE_KEY) return null;
  return new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20" });
}

function canView(role) {
  return hasPerm(role, "orders") && ["owner", "admin", "finance", "marketing"].includes(safeStr(role).toLowerCase());
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !canView(role)) {
    return { ok: false, res: json(403, { ok: false, error: "Permisos insuficientes" }) };
  }

  return { ok: true, user, role };
}

function normalizeSessionDetails(session, fallback = {}) {
  const currency = parseCurrency(
    session?.currency ||
      session?.currency_code ||
      fallback?.currency ||
      "mxn"
  );

  const amountTotalCents = Math.max(
    0,
    Math.round(
      safeNum(
        session?.amount_total ??
          session?.amount_total_cents ??
          fallback?.amount_total_cents ??
          0
      )
    )
  );

  const balanceFeeCents = Math.max(
    0,
    Math.round(
      safeNum(
        session?.balance_transaction?.fee ??
          session?.payment_intent?.charges?.data?.[0]?.balance_transaction?.fee ??
          session?.charges?.data?.[0]?.balance_transaction?.fee ??
          0
      )
    )
  );

  const feePercent = safeNum(fallback?.fee_percent, 0);
  const feeFixedMxn = safeNum(fallback?.fee_fixed_mxn, 0);
  const fx = fxToMXN(currency);

  const dynamicFeeMxn =
    balanceFeeCents > 0 ? balanceFeeCents / 100 : (amountTotalCents / 100) * (feePercent / 100);

  const totalFeeMxn = Math.max(0, dynamicFeeMxn + feeFixedMxn * fx);

  return {
    session_id: safeStr(session?.id || fallback?.session_id || ""),
    payment_intent_id: safeStr(
      typeof session?.payment_intent === "string"
        ? session.payment_intent
        : session?.payment_intent?.id || fallback?.payment_intent_id || ""
    ),
    currency,
    amount_total_cents: amountTotalCents,
    amount_total_mxn: amountTotalCents / 100,
    fee_cents: balanceFeeCents,
    fee_mxn: Math.round(totalFeeMxn * 100) / 100,
    fee_percent: feePercent,
    fee_fixed_mxn: feeFixedMxn,
    provider: "stripe",
  };
}

async function fetchStripeSession(stripe, sessionId) {
  if (!stripe || !sessionId) return null;

  try {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "payment_intent.charges.data.balance_transaction"],
    });
  } catch {
    return null;
  }
}

async function fetchStripePaymentIntent(stripe, paymentIntentId) {
  if (!stripe || !paymentIntentId) return null;

  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges.data.balance_transaction"],
    });
  } catch {
    return null;
  }
}

async function computeFeesForSessions(stripe, sessions = []) {
  const details = [];
  let total_fee_mxn = 0;

  for (const item of sessions) {
    const base = {
      session_id: item.session_id,
      payment_intent_id: item.payment_intent_id,
      currency: item.currency,
      amount_total_cents: item.amount_total_cents,
      fee_percent: item.fee_percent,
      fee_fixed_mxn: item.fee_fixed_mxn,
    };

    let session = null;

    if (item.session_id) {
      session = await fetchStripeSession(stripe, item.session_id);
    }

    if (!session && item.payment_intent_id) {
      session = await fetchStripePaymentIntent(stripe, item.payment_intent_id);
    }

    const normalized = normalizeSessionDetails(session, base);
    details.push(normalized);
    total_fee_mxn += safeNum(normalized.fee_mxn, 0);
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
    const sessions = parseSessionsInput(body, url);
    const concurrency = clampInt(body?.concurrency ?? url.searchParams.get("concurrency"), 1, 10, 5);

    if (!isUuid(orgId)) {
      return json(400, { ok: false, error: "org_id inválido" });
    }

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const stripe = stripeClient();
    if (!stripe) {
      return json(500, { ok: false, error: "STRIPE_SECRET_KEY no configurada" });
    }

    if (!sessions.length) {
      return json(200, {
        ok: true,
        org_id: orgId,
        count: 0,
        total_fee_mxn: 0,
        details: [],
      });
    }

    const limit = Math.max(1, Math.min(10, concurrency));
    const batched = [];
    for (let i = 0; i < sessions.length; i += limit) {
      batched.push(sessions.slice(i, i + limit));
    }

    let total_fee_mxn = 0;
    const details = [];

    for (const chunk of batched) {
      const result = await computeFeesForSessions(stripe, chunk);
      total_fee_mxn += safeNum(result.total_fee_mxn, 0);
      details.push(...result.details);
    }

    total_fee_mxn = Math.round(total_fee_mxn * 100) / 100;

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normalizeEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "stripe.fees.compute",
      entity: "stripe",
      entity_id: String(sessions.length),
      summary: `Computed Stripe fees for ${sessions.length} sessions`,
      meta: {
        count: sessions.length,
        concurrency: limit,
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