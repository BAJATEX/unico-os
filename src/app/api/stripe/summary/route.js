export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const USD_MXN = Number(process.env.USD_MXN || process.env.FX_USD_TO_MXN || "17.20");

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

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeStr(v).trim()
  );
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
    // 1. Auth & Params
    const { user, token, error: authError } = await requireUserFromToken(req);
    if (authError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const days = safeNum(searchParams.get("days"), 30);

    if (!isUuid(orgId)) return json({ ok: false, error: "Invalid orgId" }, 400);

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const dateIso = dateLimit.toISOString();

    const supabase = serverSupabase(token);

    // 2. EJECUCIÓN EN PARALELO (Optimización Crítica)
    // Lanzamos las 5 peticiones simultáneamente
    const [ordersRes, labelsRes, stripeBalance, stripePayouts, stripeCharges] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total_amount, stripe_session_id, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", dateIso),
      supabase
        .from("shipping_labels")
        .select("id, total_amount_mxn, raw, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", dateIso),
      fetchStripe("balance"),
      fetchStripe("payouts?limit=10"),
      fetchStripe("charges?limit=50"),
    ]);

    const orderRows = ordersRes.data || [];
    const labelRows = labelsRes.data || [];

    // 3. Cálculos de Ventas y Logística
    let salesMXN = 0;
    orderRows.forEach((o) => {
      salesMXN += safeNum(o.total_amount);
    });

    let enviaCostMXN = 0;
    labelRows.forEach((l) => {
      enviaCostMXN += safeNum(l.total_amount_mxn);
    });

    // 4. Cálculos de Stripe (Fees y Disputas)
    let stripeFeeMXN = 0;
    let refundedMXN = 0;
    let disputes = 0;

    const chargesData = stripeCharges?.data || [];
    chargesData.forEach((c) => {
      // Si el fee viene en USD (común en cuentas internacionales), convertimos usando el FX del .env
      const fee = safeNum(c.application_fee_amount || 0) / 100;
      if (c.currency === "usd") {
        stripeFeeMXN += fee * USD_MXN;
      } else {
        stripeFeeMXN += fee;
      }

      if (c.refunded) refundedMXN += safeNum(c.amount_refunded) / 100;
      if (c.disputed) disputes++;
    });

    // 5. Utilidad Visible (Ventas - Envíos - Fees Stripe)
    const visibleProfitMXN = Math.round((salesMXN - enviaCostMXN - stripeFeeMXN) * 100) / 100;

    return json({
      ok: true,
      kpi: {
        sales_mxn: Math.round(salesMXN * 100) / 100,
        envia_cost_mxn: Math.round(enviaCostMXN * 100) / 100,
        stripe_fee_mxn: Math.round(stripeFeeMXN * 100) / 100,
        visible_profit_mxn: visibleProfitMXN,
        refunded_mxn: Math.round(refundedMXN * 100) / 100,
        disputes,
        orders_count: orderRows.length
      },
      stripe_dashboard: {
        balance_available: stripeBalance?.available || [],
        balance_pending: stripeBalance?.pending || [],
        payouts: stripePayouts?.data || [],
        charges: chargesData.map((c) => ({
          id: c.id,
          status: c.status,
          paid: c.paid,
          amount: c.amount,
          created: c.created,
          currency: c.currency
        })),
      },
      meta: {
        orgId,
        days,
        fx_used: USD_MXN
      }
    });

  } catch (error) {
    console.error("Critical Route Error:", error);
    return json({ ok: false, error: "Internal Server Error" }, 500);
  }
}
