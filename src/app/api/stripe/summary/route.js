// src/app/api/stripe/summary/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { requireUserFromToken } from "@/lib/authServer";
import { getMyRoleForOrg, applyOrgFilter } from "@/lib/dbScope";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const USD_MXN = Number(process.env.USD_MXN || process.env.FX_USD_TO_MXN || "18");

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const requireBearer = (req) => {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
};

function canViewFinance(role) {
  return ["owner", "admin", "marketing"].includes(String(role || "").toLowerCase());
}

const fxToMXN = (currency) => {
  const c = String(currency || "").toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return USD_MXN;
  return 1;
};

const stripeFetch = async (path, params = {}) => {
  if (!STRIPE_KEY) throw new Error("STRIPE_SECRET_KEY no configurada en UnicOs.");

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

  const currency = String(bt?.currency || session?.currency || "mxn").toLowerCase();
  const fx = fxToMXN(currency);

  const gross = num(session?.amount_total || 0);
  const fee = num(bt?.fee || 0);
  const net = num(bt?.net || 0);
  const refunded = num(charge?.amount_refunded || 0);

  return {
    session_id: sessionId,
    gross_mxn: (gross / 100) * fx,
    fee_mxn: (fee / 100) * fx,
    net_mxn: (net / 100) * fx,
    refunded_mxn: (refunded / 100) * fx,
    disputed: !!charge?.disputed,
  };
}

export async function GET(req) {
  try {
    const token = requireBearer(req);
    const user = await requireUserFromToken(token);

    const { searchParams } = new URL(req.url);
    const orgId = String(searchParams.get("org_id") || "").trim();
    const days = Math.min(180, Math.max(7, Number(searchParams.get("days") || "30")));

    if (!orgId) {
      return json({ ok: false, error: "Falta org_id." }, 400);
    }

    const sb = serverSupabase();
    const role = await getMyRoleForOrg(sb, orgId, user);

    if (!role) return json({ ok: false, error: "No autorizado." }, 403);
    if (!canViewFinance(role)) return json({ ok: false, error: "Sin permisos." }, 403);

    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    const q = sb
      .from("orders")
      .select("id, amount_total_mxn, stripe_session_id, status, created_at, shipping_total_mxn, envia_cost_mxn")
      .in("status", ["paid", "fulfilled"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(250);

    const { data: orders, error: ordersErr } = await applyOrgFilter(q, orgId);

    if (ordersErr) throw new Error(ordersErr.message);

    const sessionIds = Array.from(
      new Set(
        (orders || [])
          .map((o) => String(o?.stripe_session_id || "").trim())
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
          }))
        )
      );
      sessionMetrics.push(...result);
    }

    const grossOrdersMXN = (orders || []).reduce((a, o) => a + num(o.amount_total_mxn), 0);
    const enviaCostMXN = (orders || []).reduce((a, o) => {
      const real = num(o.envia_cost_mxn);
      if (real > 0) return a + real;
      return a;
    }, 0);

    const stripeFeeMXN = sessionMetrics.reduce((a, x) => a + num(x.fee_mxn), 0);
    const stripeNetMXN = sessionMetrics.reduce((a, x) => a + num(x.net_mxn), 0);
    const refundedMXN = sessionMetrics.reduce((a, x) => a + num(x.refunded_mxn), 0);
    const disputes = sessionMetrics.reduce((a, x) => a + (x.disputed ? 1 : 0), 0);

    const visibleProfitMXN = Math.max(
      0,
      Math.round((grossOrdersMXN - stripeFeeMXN - enviaCostMXN) * 0.7 * 100) / 100
    );

    const [balance, payouts, charges] = await Promise.all([
      stripeFetch("/v1/balance"),
      stripeFetch("/v1/payouts", { limit: "10" }),
      stripeFetch("/v1/charges", { limit: "20" }),
    ]);

    return json({
      ok: true,
      scope: {
        org_id: orgId,
        days,
        orders_count: (orders || []).length,
        stripe_sessions_count: sessionIds.length,
      },
      kpi: {
        sales_mxn: Math.round(grossOrdersMXN * 100) / 100,
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
        charges: (charges?.data || []).map((c) => ({
          id: c.id,
          created: c.created,
          status: c.status,
          paid: c.paid,
          amount: c.amount,
          amount_refunded: c.amount_refunded,
          currency: c.currency,
          disputed: !!c.disputed,
        })),
      },
      sessions: sessionMetrics.slice(0, 40),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}