// src/app/api/stripe/summary/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const USD_MXN = Number(process.env.USD_MXN || process.env.FX_USD_TO_MXN || "18");

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.*)$/i);
  return m ? m[1] : "";
}

function fxToMXN(currency) {
  const c = String(currency || "mxn").toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return Math.max(0.0001, USD_MXN);
  const envKey = `FX_${c.toUpperCase()}_TO_MXN`;
  const fx = Number(process.env[envKey] || NaN);
  return Number.isFinite(fx) && fx > 0 ? fx : 1;
}

function isRowActive(row) {
  return row?.deleted_at == null;
}

function normalizeMoneyRow(row) {
  const amountCents =
    safeNum(row?.amount_total_cents, NaN) ||
    safeNum(row?.total_cents, NaN) ||
    safeNum(row?.subtotal_cents, NaN) ||
    0;

  const shippingCents =
    safeNum(row?.amount_shipping_cents, NaN) ||
    safeNum(row?.shipping_cents, NaN) ||
    0;

  const discountCents =
    safeNum(row?.amount_discount_cents, NaN) ||
    safeNum(row?.discount_cents, NaN) ||
    0;

  return {
    amount_cents: Math.max(0, Math.round(amountCents)),
    shipping_cents: Math.max(0, Math.round(shippingCents)),
    discount_cents: Math.max(0, Math.round(discountCents)),
  };
}

function orderMoney(row) {
  const cents = normalizeMoneyRow(row).amount_cents;
  if (cents > 0) return cents / 100;

  const mxn =
    safeNum(row?.amount_total_mxn, NaN) ||
    safeNum(row?.total_mxn, NaN) ||
    safeNum(row?.subtotal_mxn, NaN) ||
    0;

  return Number.isFinite(mxn) ? mxn : 0;
}

function shippingMoney(row) {
  const { shipping_cents } = normalizeMoneyRow(row);
  if (shipping_cents > 0) return shipping_cents / 100;
  return safeNum(row?.envia_cost_mxn, 0);
}

function enviaMoney(row) {
  return safeNum(row?.envia_cost_mxn, 0);
}

function refundedMxn(charge) {
  if (!charge) return 0;

  const refunded = Boolean(charge?.refunded);
  const amount = safeNum(charge?.amount, 0) / 100;

  if (!refunded) return 0;

  const refunds = Array.isArray(charge?.refunds?.data) ? charge.refunds.data : [];
  if (refunds.length) {
    return refunds.reduce((acc, r) => acc + safeNum(r?.amount, 0) / 100, 0);
  }

  return amount;
}

function chargeFeeMxn(charge) {
  const bt = charge?.balance_transaction;
  const btObj = typeof bt === "object" && bt ? bt : null;
  const feeCents = safeNum(btObj?.fee, NaN) || safeNum(charge?.application_fee_amount, NaN) || 0;
  const feeCurrency = String(btObj?.currency || charge?.currency || "mxn").toLowerCase();
  return (Math.max(0, feeCents) / 100) * fxToMXN(feeCurrency);
}

function getBearerTokenFromReq(req) {
  return getBearerToken(req);
}

async function fetchStripe(path, query = {}) {
  if (!STRIPE_KEY) return null;

  try {
    const url = new URL(`https://api.stripe.com/v1/${path}`);
    for (const [k, v] of Object.entries(query || {})) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error?.message || `Stripe error (${res.status})`));
    }
    return data;
  } catch (e) {
    return { error: String(e?.message || e) };
  }
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

function parseDays(v, fallback = 30) {
  const n = Math.floor(safeNum(v, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(365, n));
}

function normalizeCurrency(value) {
  return String(value || "mxn").toLowerCase();
}

async function authorize(req, sb, orgId) {
  const token = getBearerTokenFromReq(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "No autorizado" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "dashboard")) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

async function loadOrders(sb, orgId, days) {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - days);

  const q = sb
    .from("orders")
    .select(
      [
        "id",
        "org_id",
        "organization_id",
        "stripe_session_id",
        "checkout_session_id",
        "session_id",
        "status",
        "payment_status",
        "amount_total_cents",
        "total_cents",
        "subtotal_cents",
        "amount_total_mxn",
        "total_mxn",
        "subtotal_mxn",
        "amount_shipping_cents",
        "shipping_cents",
        "shipping_total_mxn",
        "amount_shipping_mxn",
        "amount_discount_cents",
        "discount_cents",
        "amount_discount_mxn",
        "deleted_at",
        "created_at",
        "updated_at",
        "envia_cost_mxn",
      ].join(", ")
    )
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .gte("created_at", limitDate.toISOString())
    .order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw new Error(error.message || "No se pudieron cargar pedidos");
  return Array.isArray(data) ? data.filter(isRowActive) : [];
}

async function loadShippingLabels(sb, orgId, days) {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - days);

  const q = sb
    .from("shipping_labels")
    .select(
      [
        "id",
        "org_id",
        "organization_id",
        "status",
        "shipment_status",
        "shipping_status",
        "envia_cost_mxn",
        "tracking_number",
        "carrier",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .gte("created_at", limitDate.toISOString())
    .order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw new Error(error.message || "No se pudieron cargar guías");
  return Array.isArray(data) ? data : [];
}

async function loadStripeBalances() {
  const balance = await fetchStripe("balance");
  const payouts = await fetchStripe("payouts", { limit: 10 });
  return {
    balance,
    payouts,
  };
}

async function loadStripeCharges(sessionIds) {
  const out = [];
  for (const sessionId of sessionIds) {
    try {
      const session = await fetchStripe(`checkout/sessions/${encodeURIComponent(sessionId)}`, {
        "expand[]": ["payment_intent.latest_charge.balance_transaction"],
      });

      if (!session) continue;

      const pi = session?.payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id;
      if (!piId) continue;

      const paymentIntent =
        typeof pi === "object" && pi
          ? pi
          : await fetchStripe(`payment_intents/${encodeURIComponent(piId)}`, {
              "expand[]": ["latest_charge.balance_transaction"],
            });

      const latestCharge = paymentIntent?.latest_charge;
      const chId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
      if (!chId) continue;

      const charge =
        typeof latestCharge === "object" && latestCharge
          ? latestCharge
          : await fetchStripe(`charges/${encodeURIComponent(chId)}`, {
              "expand[]": ["balance_transaction"],
            });

      if (charge) out.push(charge);
    } catch {}
  }
  return out;
}

function uniqueSessionIds(orders) {
  return Array.from(
    new Set(
      (Array.isArray(orders) ? orders : [])
        .map((o) =>
          safeStr(
            o?.stripe_session_id ||
              o?.checkout_session_id ||
              o?.session_id ||
              o?.id
          ).trim()
        )
        .filter(Boolean)
    )
  );
}

function summarizeOrders(orders) {
  const salesMXN = orders.reduce((acc, row) => acc + safeNum(orderMoney(row), 0), 0);
  const shippingCollectedMXN = orders.reduce((acc, row) => acc + safeNum(shippingMoney(row), 0), 0);
  const orderRefundedMXN = orders.reduce((acc, row) => {
    const st = String(row?.status || row?.payment_status || "").toLowerCase();
    if (st !== "refunded") return 0;
    return safeNum(orderMoney(row), 0);
  }, 0);

  return {
    salesMXN,
    shippingCollectedMXN,
    orderRefundedMXN,
  };
}

function summarizeLabels(labels) {
  const enviaCostMXN = labels.reduce((acc, row) => acc + safeNum(enviaMoney(row), 0), 0);
  return { enviaCostMXN };
}

function summarizeCharges(chargesList) {
  let stripeFeeMXN = 0;
  let refundedMXN = 0;
  let disputes = 0;

  for (const c of chargesList) {
    stripeFeeMXN += chargeFeeMxn(c);
    refundedMXN += refundedMxn(c);
    if (c?.disputed) disputes += 1;
  }

  return { stripeFeeMXN, refundedMXN, disputes };
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);

    const orgId = await resolveOrgId(
      sb,
      url.searchParams.get("org_id") ||
        url.searchParams.get("orgId") ||
        ""
    );

    const days = parseDays(url.searchParams.get("days") || "30", 30);

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const orders = await loadOrders(sb, orgId, days);
    const labels = await loadShippingLabels(sb, orgId, days);
    const sessionIds = uniqueSessionIds(orders);
    const chargesList = STRIPE_KEY ? await loadStripeCharges(sessionIds) : [];
    const { balance, payouts } = STRIPE_KEY
      ? await loadStripeBalances()
      : { balance: null, payouts: null };

    const { salesMXN, shippingCollectedMXN, orderRefundedMXN } = summarizeOrders(orders);
    const { enviaCostMXN } = summarizeLabels(labels);
    const { stripeFeeMXN, refundedMXN, disputes } = summarizeCharges(chargesList);

    const visibleProfitMXN = salesMXN - enviaCostMXN - stripeFeeMXN;
    const stripeNetMXN = salesMXN - stripeFeeMXN - refundedMXN;

    const chargesPublic = chargesList.map((c) => ({
      id: c.id,
      created: c.created,
      status: c.status,
      paid: c.paid,
      amount: c.amount,
      currency: normalizeCurrency(c.currency),
      receipt_url: c.receipt_url,
      refunded: c.refunded,
      disputed: c.disputed,
    }));

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "stripe.summary.read",
      entity: "stripe",
      entity_id: String(days),
      summary: `Read Stripe summary for ${days} days`,
      meta: {
        days,
        orders_count: orders.length,
        stripe_sessions_count: sessionIds.length,
        charges_count: chargesList.length,
        role: auth.role,
        source: "api/stripe/summary",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(
      {
        ok: true,
        scope: {
          org_id: orgId,
          days,
          role: auth.role,
          orders_count: orders.length,
          stripe_sessions_count: sessionIds.length,
        },
        kpi: {
          sales_mxn: Math.round(salesMXN * 100) / 100,
          shipping_collected_mxn: Math.round(shippingCollectedMXN * 100) / 100,
          stripe_fee_mxn: Math.round(stripeFeeMXN * 100) / 100,
          envia_cost_mxn: Math.round(enviaCostMXN * 100) / 100,
          visible_profit_mxn: Math.round(visibleProfitMXN * 100) / 100,
          stripe_net_mxn: Math.round(stripeNetMXN * 100) / 100,
          refunded_mxn: Math.round(refundedMXN * 100) / 100,
          disputes,
          order_refunded_mxn: Math.round(orderRefundedMXN * 100) / 100,
        },
        stripe_dashboard: {
          balance_available: balance?.available || [],
          balance_pending: balance?.pending || [],
          payouts: payouts?.data || [],
          charges: chargesPublic,
        },
        rows: {
          orders,
          shipping_labels: labels,
        },
        updated_at: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function POST(req) {
  return GET(req);
}