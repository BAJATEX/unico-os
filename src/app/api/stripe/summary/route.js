export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

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
const normEmail = (s) => safeStr(s).trim().toLowerCase();

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeStr(v).trim()
  );
}

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

async function getMyRoleForOrg(sb, orgId, user) {
  const email = normEmail(user?.email);
  const uid = safeStr(user?.id);

  const q1 = await sb
    .from("admin_users")
    .select("role,is_active,organization_id,org_id,email,user_id")
    .eq("is_active", true)
    .or(`organization_id.eq.${orgId},org_id.eq.${orgId}`)
    .or(`email.ilike.${email},user_id.eq.${uid}`)
    .limit(20);

  if (!q1.error && Array.isArray(q1.data) && q1.data.length) {
    const exact =
      q1.data.find((r) => safeStr(r?.organization_id || r?.org_id) === safeStr(orgId)) || q1.data[0];
    return safeStr(exact?.role).toLowerCase();
  }

  return null;
}

function canViewFinance(role) {
  return ["owner", "admin", "marketing"].includes(safeStr(role).toLowerCase());
}

const fxToMXN = (currency) => {
  const c = safeStr(currency).toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return USD_MXN;
  return 1;
};

const stripeFetch = async (path, params = {}) => {
  if (!STRIPE_KEY) {
    throw new Error("STRIPE_SECRET_KEY no configurada en UnicOs.");
  }

  const url = new URL(`https://api.stripe.com${path}`);

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) {
      v.forEach((item) => url.searchParams.append(k, String(item)));
    } else {
      url.searchParams.set(k, String(v));
    }
  });

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Stripe error (${res.status})`);
  }

  return data;
};

async function getSessionChargeMetrics(sessionId) {
  const session = await stripeFetch(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    "expand[]": ["payment_intent.latest_charge.balance_transaction"],
  });

  const pi = session?.payment_intent;
  const charge = pi?.latest_charge;
  const bt = charge?.balance_transaction;

  const currency = safeStr(bt?.currency || session?.currency || "mxn").toLowerCase();
  const fx = fxToMXN(currency);

  const gross = safeNum(session?.amount_total, 0);
  const fee = safeNum(bt?.fee, 0);
  const net = safeNum(bt?.net, 0);
  const refunded = safeNum(charge?.amount_refunded, 0);

  return {
    session_id: sessionId,
    gross_mxn: (gross / 100) * fx,
    fee_mxn: (fee / 100) * fx,
    net_mxn: (net / 100) * fx,
    refunded_mxn: (refunded / 100) * fx,
    disputed: !!charge?.disputed,
    currency,
  };
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr || !user) {
      return json({ ok: false, error: "No autorizado." }, 401);
    }

    const { searchParams } = new URL(req.url);
    const orgId = safeStr(searchParams.get("org_id")).trim();
    const days = Math.max(7, Math.min(180, safeNum(searchParams.get("days"), 30)));

    if (!isUuid(orgId)) {
      return json({ ok: false, error: "Falta org_id válido." }, 400);
    }

    const role = await getMyRoleForOrg(sb, orgId, user);

    if (!role) return json({ ok: false, error: "No autorizado." }, 403);
    if (!canViewFinance(role)) return json({ ok: false, error: "Sin permisos." }, 403);

    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error: ordersErr } = await sb
      .from("orders")
      .select(`
        id,
        amount_total_mxn,
        stripe_session_id,
        stripe_payment_intent_id,
        status,
        created_at,
        shipping_total_mxn,
        envia_cost_mxn,
        org_id,
        organization_id
      `)
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .in("status", ["paid", "fulfilled"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(250);

    if (ordersErr) {
      throw new Error(ordersErr.message || "No se pudieron leer órdenes.");
    }

    const orderRows = Array.isArray(orders) ? orders : [];

    const sessionIds = Array.from(
      new Set(
        orderRows
          .map((o) => safeStr(o?.stripe_session_id).trim())
          .filter(Boolean)
      )
    ).slice(0, 120);

    const sessionMetrics = [];
    for (let i = 0; i < sessionIds.length; i += 5) {
      const chunk = sessionIds.slice(i, i + 5);
      const result = await Promise.all(
        chunk.map((sid) =>
          getSessionChargeMetrics(sid).catch(() => ({
            session_id: sid,
            gross_mxn: 0,
            fee_mxn: 0,
            net_mxn: 0,
            refunded_mxn: 0,
            disputed: false,
            currency: "mxn",
          }))
        )
      );
      sessionMetrics.push(...result);
    }

    const salesMXN = orderRows.reduce((acc, o) => acc + safeNum(o?.amount_total_mxn, 0), 0);
    const stripeFeeMXN = sessionMetrics.reduce((acc, x) => acc + safeNum(x?.fee_mxn, 0), 0);
    const stripeNetMXN = sessionMetrics.reduce((acc, x) => acc + safeNum(x?.net_mxn, 0), 0);
    const refundedMXN = sessionMetrics.reduce((acc, x) => acc + safeNum(x?.refunded_mxn, 0), 0);
    const enviaCostMXN = orderRows.reduce((acc, o) => acc + safeNum(o?.envia_cost_mxn, 0), 0);
    const shippingCollectedMXN = orderRows.reduce(
      (acc, o) => acc + safeNum(o?.shipping_total_mxn, 0),
      0
    );
    const disputes = sessionMetrics.reduce((acc, x) => acc + (x?.disputed ? 1 : 0), 0);

    const visibleProfitMXN = Math.max(
      0,
      Math.round((salesMXN - stripeFeeMXN - enviaCostMXN) * 0.7 * 100) / 100
    );

    let balance = null;
    let payouts = null;
    let charges = null;

    try {
      const [balanceRes, payoutsRes, chargesRes] = await Promise.all([
        stripeFetch("/v1/balance"),
        stripeFetch("/v1/payouts", { limit: "10" }),
        stripeFetch("/v1/charges", { limit: "20" }),
      ]);

      balance = balanceRes || null;
      payouts = payoutsRes || null;
      charges = chargesRes || null;
    } catch {
      balance = null;
      payouts = null;
      charges = null;
    }

    return json({
      ok: true,
      scope: {
        org_id: orgId,
        days,
        role,
        orders_count: orderRows.length,
        stripe_sessions_count: sessionIds.length,
      },
      kpi: {
        sales_mxn: Math.round(salesMXN * 100) / 100,
        shipping_collected_mxn: Math.round(shippingCollectedMXN * 100) / 100,
        stripe_fee_mxn: Math.round(stripeFeeMXN * 100) / 100,
        envia_cost_mxn: Math.round(enviaCostMXN * 100) / 100,
        visible_profit_mxn: visibleProfitMXN,
        stripe_net_mxn: Math.round(stripeNetMXN * 100) / 100,
        refunded_mxn: Math.round(refundedMXN * 100) / 100,
        disputes,
      },
      stripe_dashboard: {
        balance_available: balance?.available || [],
        balance_pending: balance?.pending || [],
        payouts: payouts?.data || [],
        charges: Array.isArray(charges?.data)
          ? charges.data.map((c) => ({
              id: c.id,
              created: c.created,
              status: c.status,
              paid: c.paid,
              amount: c.amount,
              amount_refunded: c.amount_refunded,
              currency: c.currency,
              disputed: !!c.disputed,
            }))
          : [],
      },
      sessions: sessionMetrics.slice(0, 40),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
