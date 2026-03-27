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

// Helper para llamadas directas a Stripe (Optimizado)
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
  } catch { return null; }
}

export async function GET(req) {
  try {
    const { user, token, error: authError } = await requireUserFromToken(req);
    if (authError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const days = safeNum(searchParams.get("days"), 30);
    
    if (!orgId) return json({ ok: false, error: "Missing orgId" }, 400);

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const dateIso = dateLimit.toISOString();

    const supabase = serverSupabase(token);

    // 🚀 EJECUCIÓN PARALELA: Reducción de latencia en Vercel
    const [ordersRes, labelsRes, stripeBalance, stripePayouts, stripeCharges] = await Promise.all([
      supabase.from("orders").select("*").eq("organization_id", orgId).gte("created_at", dateIso),
      supabase.from("shipping_labels").select("*").eq("organization_id", orgId).gte("created_at", dateIso),
      fetchStripe("balance"),
      fetchStripe("payouts?limit=10"),
      fetchStripe("charges?limit=50"),
    ]);

    const orderRows = ordersRes.data || [];
    const labelRows = labelsRes.data || [];

    // Lógica de Negocio UnicOs
    let salesMXN = 0;
    let shippingCollectedMXN = 0;
    orderRows.forEach(o => {
      salesMXN += safeNum(o.total_amount);
      shippingCollectedMXN += safeNum(o.shipping_amount || 0);
    });

    let enviaCostMXN = 0;
    labelRows.forEach(l => { enviaCostMXN += safeNum(l.total_amount_mxn); });

    let stripeFeeMXN = 0;
    let refundedMXN = 0;
    let stripeNetMXN = 0;
    let disputes = 0;

    const chargesData = stripeCharges?.data || [];
    chargesData.forEach(c => {
      const fee = (safeNum(c.application_fee_amount) || (c.amount * 0.039 + 3)) / 100;
      const amount = safeNum(c.amount) / 100;
      
      if (c.currency === "usd") {
        stripeFeeMXN += fee * USD_MXN;
        stripeNetMXN += (amount - fee) * USD_MXN;
      } else {
        stripeFeeMXN += fee;
        stripeNetMXN += (amount - fee);
      }
      if (c.refunded) refundedMXN += safeNum(c.amount_refunded) / 100;
      if (c.disputed) disputes++;
    });

    const visibleProfitMXN = Math.round((salesMXN - enviaCostMXN - stripeFeeMXN) * 100) / 100;

    return json({
      ok: true,
      scope: { orgId, days, orders_count: orderRows.length },
      kpi: {
        sales_mxn: Math.round(salesMXN * 100) / 100,
        shipping_collected_mxn: Math.round(shippingCollectedMXN * 100) / 100,
        stripe_fee_mxn: Math.round(stripeFeeMXN * 100) / 100,
        envia_cost_mxn: Math.round(enviaCostMXN * 100) / 100,
        visible_profit_mxn: visibleProfitMXN,
        stripe_net_mxn: Math.round(stripeNetMXN * 100) / 100,
        refunded_mxn: Math.round(refundedMXN * 100) / 100,
        disputes
      },
      stripe_dashboard: {
        balance_available: stripeBalance?.available || [],
        balance_pending: stripeBalance?.pending || [],
        payouts: stripePayouts?.data || [],
        charges: chargesData.map(c => ({
          id: c.id, status: c.status, paid: c.paid, amount: c.amount, created: c.created
        }))
      }
    });
  } catch (error) {
    console.error("Route Error:", error);
    return json({ ok: false, error: "Internal Server Error" }, 500);
  }
}
