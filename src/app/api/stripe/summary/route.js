export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

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
  const h = req.headers.get("authorization");
  if (!h) return "";
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
    if (!res.ok) return null;
    return data;
  } catch {
    return null;
  }
}

function orderMoney(row) {
  return (
    safeNum(row?.amount_total_mxn, NaN) ||
    safeNum(row?.total_amount_mxn, NaN) ||
    safeNum(row?.total_cents, NaN) / 100 ||
    safeNum(row?.amount_total_cents, NaN) / 100 ||
    safeNum(row?.total_amount, NaN)
  );
}

function shippingMoney(row) {
  return (
    safeNum(row?.shipping_total_mxn, NaN) ||
    safeNum(row?.shipping_cents, NaN) / 100 ||
    safeNum(row?.shipping_cost, NaN) ||
    safeNum(row?.shipping_collected_mxn, NaN)
  );
}

function enviaMoney(row) {
  return (
    safeNum(row?.envia_cost_mxn, NaN) ||
    safeNum(row?.total_amount_mxn, NaN) ||
    safeNum(row?.amount_total_mxn, NaN) ||
    safeNum(row?.total_cents, NaN) / 100 ||
    safeNum(row?.amount_total_cents, NaN) / 100
  );
}

function chargeFeeMxn(charge) {
  const bt = charge?.balance_transaction;
  const feeCents =
    safeNum(bt?.fee, NaN) ||
    safeNum(charge?.application_fee_amount, NaN) ||
    safeNum(charge?.fee, NaN) ||
    0;

  const currency = safeStr(bt?.currency || charge?.currency || "mxn").toLowerCase();
  const fx = fxToMXN(currency);
  return (feeCents / 100) * fx;
}

function refundedMxn(charge) {
  const amountRefundedCents = safeNum(charge?.amount_refunded, 0);
  const currency = safeStr(charge?.currency || "mxn").toLowerCase();
  const fx = fxToMXN(currency);
  return (amountRefundedCents / 100) * fx;
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(req.url);
    const orgId = safeStr(searchParams.get("org_id") || searchParams.get("orgId")).trim();
    const days = Math.max(1, Math.min(365, safeNum(searchParams.get("days"), 30)));

    if (!isUuid(orgId)) {
      return json({ ok: false, error: "Invalid org_id" }, 400);
    }

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !["owner", "admin", "marketing"].includes(role)) {
      return json({ ok: false, error: "Permisos insuficientes" }, 403);
    }

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const dateIso = dateLimit.toISOString();

    const [ordersRes, labelsRes, balance, payouts, charges] = await Promise.all([
      sb
        .from("orders")
        .select("*")
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .gte("created_at", dateIso),
      sb
        .from("shipping_labels")
        .select("*")
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .gte("created_at", dateIso),
      fetchStripe("balance"),
      fetchStripe("payouts", { limit: 10 }),
      fetchStripe("charges", { limit: 50, "expand[]": ["data.balance_transaction"] }),
    ]);

    const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
    const labels = Array.isArray(labelsRes?.data) ? labelsRes.data : [];
    const chargesList = Array.isArray(charges?.data) ? charges.data : [];

    const salesMXN = orders.reduce((acc, row) => acc + safeNum(orderMoney(row), 0), 0);
    const shippingCollectedMXN = orders.reduce((acc, row) => acc + safeNum(shippingMoney(row), 0), 0);
    const enviaCostMXN = labels.reduce((acc, row) => acc + safeNum(enviaMoney(row), 0), 0);

    let stripeFeeMXN = 0;
    let refundedMXN = 0;
    let disputes = 0;

    for (const c of chargesList) {
      stripeFeeMXN += chargeFeeMxn(c);
      refundedMXN += refundedMxn(c);
      if (c?.disputed) disputes += 1;
    }

    const visibleProfitMXN = salesMXN - enviaCostMXN - stripeFeeMXN;
    const stripeNetMXN = salesMXN - stripeFeeMXN - refundedMXN;

    const sessionIds = Array.from(
      new Set(
        orders
          .map((o) => safeStr(o.stripe_session_id || o.checkout_session_id || o.session_id || o.id))
          .filter(Boolean)
      )
    );

    return json({
      ok: true,
      scope: {
        org_id: orgId,
        days,
        role,
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
      },
      stripe_dashboard: {
        balance_available: balance?.available || [],
        balance_pending: balance?.pending || [],
        payouts: payouts?.data || [],
        charges: chargesList.map((c) => ({
          id: c.id,
          created: c.created,
          status: c.status,
          paid: c.paid,
          amount: c.amount,
          currency: c.currency,
          receipt_url: c.receipt_url,
          refunded: c.refunded,
          disputed: c.disputed,
        })),
      },
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}