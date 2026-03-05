import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { requireUserFromToken } from "@/lib/authServer";
import { hasPerm } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const USD_MXN = Number(process.env.USD_MXN || "17.0"); // fallback razonable

const json = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fxToMXN = (currency) => {
  const c = String(currency || "").toLowerCase();
  if (c === "mxn") return 1;
  if (c === "usd") return USD_MXN;
  // si Stripe devuelve otra moneda, no inventamos tasas:
  // devolvemos 1 y marcamos moneda en la respuesta.
  return 1;
};

const stripeFetch = async (path, params = {}) => {
  if (!STRIPE_KEY) throw new Error("STRIPE_SECRET_KEY no configurada en UnicOs");
  const url = new URL(`https://api.stripe.com${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
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
    const msg = data?.error?.message || data?.message || `Stripe error (${res.status})`;
    throw new Error(msg);
  }
  return data;
};

const getSessionCharge = async (sessionId) => {
  // 1) Checkout Session -> Payment Intent (expand)
  const sess = await stripeFetch(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    "expand[]": "payment_intent",
  });

  const pi = sess?.payment_intent;
  const currency = String(sess?.currency || pi?.currency || "mxn").toLowerCase();
  const fx = fxToMXN(currency);

  const paidAmount = num(sess?.amount_total ?? 0);
  const paidAmountMXN = Math.round((paidAmount / 100) * fx * 100);

  const chargeId = pi?.latest_charge || null;
  if (!chargeId) {
    return {
      session_id: sessionId,
      currency,
      amount_paid_mxn: paidAmountMXN,
      fee_mxn: 0,
      net_mxn: 0,
      refunded_mxn: 0,
      disputed: false,
      charge_id: null,
    };
  }

  // 2) Charge -> expand balance_transaction + refunds
  const ch = await stripeFetch(`/v1/charges/${encodeURIComponent(chargeId)}`, {
    "expand[]": "balance_transaction",
  });

  const bt = ch?.balance_transaction || null;
  const fee = num(bt?.fee ?? 0); // en centavos de la moneda
  const net = num(bt?.net ?? 0);

  const feeMXN = Math.round((fee / 100) * fx * 100);
  const netMXN = Math.round((net / 100) * fx * 100);

  const refunded = num(ch?.amount_refunded ?? 0);
  const refundedMXN = Math.round((refunded / 100) * fx * 100);

  const disputed = !!ch?.disputed;

  return {
    session_id: sessionId,
    currency,
    amount_paid_mxn: paidAmountMXN,
    fee_mxn: feeMXN,
    net_mxn: netMXN,
    refunded_mxn: refundedMXN,
    disputed,
    charge_id: chargeId,
  };
};

export async function GET(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = await requireUserFromToken(token);

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id") || "";
    const days = Math.min(120, Math.max(7, Number(searchParams.get("days") || "30")));

    if (!orgId) return json({ ok: false, error: "Falta org_id" }, 400);

    const sb = serverSupabase();
    const { data: adminRow, error: adminErr } = await sb
      .from("admin_users")
      .select("id, role, is_active, organization_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .or(`user_id.eq.${user.id},email.ilike.${user.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (adminErr || !adminRow) return json({ ok: false, error: "No autorizado" }, 403);
    if (!hasPerm(adminRow.role, "view_finance")) return json({ ok: false, error: "Sin permisos" }, 403);

    // Orders reales (tu tienda)
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    const { data: orders, error: ordersErr } = await sb
      .from("orders")
      .select("id, organization_id, status, amount_total_mxn, stripe_session_id, created_at")
      .eq("organization_id", orgId)
      .in("status", ["paid", "fulfilled"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(120);

    if (ordersErr) throw new Error(ordersErr.message);

    const sessionIds = Array.from(
      new Set((orders || []).map((o) => o.stripe_session_id).filter(Boolean))
    ).slice(0, 60);

    // Stripe global (lo que ves en dashboard Stripe)
    const [balance, payouts] = await Promise.all([
      stripeFetch("/v1/balance"),
      stripeFetch("/v1/payouts", { limit: "10" }),
    ]);

    // Stripe por sesiones (tu tienda)
    const sessions = [];
    for (const sid of sessionIds) {
      try {
        sessions.push(await getSessionCharge(sid));
      } catch (e) {
        sessions.push({
          session_id: sid,
          currency: "unknown",
          amount_paid_mxn: 0,
          fee_mxn: 0,
          net_mxn: 0,
          refunded_mxn: 0,
          disputed: false,
          charge_id: null,
          error: String(e?.message || e),
        });
      }
    }

    const grossOrdersMXN = (orders || []).reduce((a, o) => a + num(o.amount_total_mxn), 0);
    const stripeFeeMXN = sessions.reduce((a, s) => a + num(s.fee_mxn), 0) / 100;
    const stripeNetMXN = sessions.reduce((a, s) => a + num(s.net_mxn), 0) / 100;
    const refundedMXN = sessions.reduce((a, s) => a + num(s.refunded_mxn), 0) / 100;
    const disputeCount = sessions.filter((s) => !!s.disputed).length;

    // balance: viene en centavos por moneda
    const available = balance?.available || [];
    const pending = balance?.pending || [];

    return json({
      ok: true,
      scope: {
        org_id: orgId,
        days,
        orders_count: (orders || []).length,
        stripe_sessions_count: sessionIds.length,
      },
      kpi: {
        // “Tu tienda”: basado en orders + sesiones reales
        gross_orders_mxn: grossOrdersMXN,
        stripe_fee_mxn: Math.round(stripeFeeMXN * 100) / 100,
        stripe_net_mxn: Math.round(stripeNetMXN * 100) / 100,
        refunded_mxn: Math.round(refundedMXN * 100) / 100,
        disputes: disputeCount,
      },
      stripe_dashboard: {
        balance_available: available, // array por moneda (como Stripe)
        balance_pending: pending,
        payouts: payouts?.data || [],
      },
      sessions: sessions.slice(0, 30), // detalle útil sin saturar
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}