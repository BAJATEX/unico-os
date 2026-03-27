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
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.*)$/i);
  return m ? m[1] : null;
}

// Helper para llamadas a Stripe sin SDK
async function fetchStripe(path) {
  if (!STRIPE_KEY) return null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const { user, token, error: authError } = await requireUserFromToken(req);
    if (authError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const days = safeNum(searchParams.get("days"), 30);
    const role = searchParams.get("role") || "admin";

    if (!isUuid(orgId)) return json({ ok: false, error: "Invalid orgId" }, 400);

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const dateIso = dateLimit.toISOString();

    const supabase = serverSupabase(token);

    // --- INICIO DE OPTIMIZACIÓN EN PARALELO ---
    let ordersRes, labelsRes, balance, payouts, charges;
    
    try {
      [ordersRes, labelsRes, balance, payouts, charges] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("organization_id", orgId)
          .gte("created_at", dateIso),
        supabase
          .from("shipping_labels")
          .select("*")
          .eq("organization_id", orgId)
          .gte("created_at", dateIso),
        fetchStripe("balance"),
        fetchStripe("payouts?limit=10"),
        fetchStripe("charges?limit=50")
      ]);
    } catch {
      balance = null;
      payouts = null;
      charges = null;
    }
    // --- FIN DE OPTIMIZACIÓN ---

    const orderRows = ordersRes?.data || [];
    const labelRows = labelsRes?.data || [];

    let salesMXN = 0;
    let shippingCollectedMXN = 0;
    const sessionIds = [];

    orderRows.forEach((o) => {
      salesMXN += safeNum(o.total_amount);
      shippingCollectedMXN += safeNum(o.shipping_cost || o.shipping_collected_mxn);
      
      if (o.stripe_session_id) {
        if (!sessionIds.includes(o.stripe_session_id)) {
          sessionIds.push(o.stripe_session_id);
        }
      }
    });

    let enviaCostMXN = 0;
    labelRows.forEach((l) => {
      enviaCostMXN += safeNum(l.total_amount_mxn);
    });

    let stripeFeeMXN = 0;
    let refundedMXN = 0;
    let disputes = 0;

    const chargesList = charges?.data || [];
    chargesList.forEach((c) => {
      const fee = safeNum(c.application_fee_amount || 0) / 100;
      if (c.currency === "usd") {
        stripeFeeMXN += fee * USD_MXN;
      } else {
        stripeFeeMXN += fee;
      }

      if (c.refunded) refundedMXN += safeNum(c.amount_refunded) / 100;
      if (c.disputed) disputes++;
    });

    const visibleProfitMXN = salesMXN - enviaCostMXN - stripeFeeMXN;
    const stripeNetMXN = salesMXN - stripeFeeMXN - refundedMXN;

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
        visible_profit_mxn: Math.round(visibleProfitMXN * 100) / 100,
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
              currency: c.currency,
              receipt_url: c.receipt_url,
              payment_method_details: c.payment_method_details,
              refunded: c.refunded,
              disputed: c.disputed
            }))
          : [],
      },
    });

  } catch (error) {
    console.error("Route Error:", error);
    return json({ ok: false, error: "Internal Server Error" }, 500);
  }
}
