// src/app/api/stripe/refund/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const normEmail = (s) => String(s || "").trim().toLowerCase();

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || "").trim());

async function getMyRole(sb, orgId, user) {
  const myEmail = normEmail(user?.email);
  const uid = user?.id || "00000000-0000-0000-0000-000000000000";

  const q1 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q1?.error && q1?.data?.is_active) return String(q1.data.role || "").toLowerCase();

  const q2 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q2?.error && q2?.data?.is_active) return String(q2.data.role || "").toLowerCase();
  return null;
}

export async function POST(req) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return json(400, { ok: false, error: "Falta STRIPE_SECRET_KEY." });

    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || body?.organization_id || "").trim();
    const orderId = String(body?.order_id || "").trim();

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido." });
    if (!orderId) return json(400, { ok: false, error: "order_id requerido." });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !hasPerm(role, "orders")) {
      return json(403, { ok: false, error: "Permisos insuficientes." });
    }

    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id, stripe_payment_intent_id, stripe_session_id, status, amount_total_mxn, org_id, organization_id")
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .eq("id", orderId)
      .maybeSingle();

    if (oErr || !order) return json(404, { ok: false, error: "Pedido no encontrado." });

    const pi = String(order?.stripe_payment_intent_id || "").trim();
    if (!pi) return json(400, { ok: false, error: "Este pedido no tiene payment_intent en DB." });

    const payload = new URLSearchParams();
    payload.set("payment_intent", pi);

    const res = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
    });

    const refund = await res.json().catch(() => null);
    if (!res.ok) return json(400, { ok: false, error: refund?.error?.message || "Stripe refund error." });

    const before = { status: order?.status || null };

    await sb
      .from("orders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .eq("id", orderId);

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "stripe.refund",
      entity: "orders",
      entity_id: orderId,
      summary: "Refund created and order marked as refunded",
      before,
      after: { status: "refunded" },
      meta: {
        refund_id: refund?.id || null,
        payment_intent: pi,
        stripe_session_id: order?.stripe_session_id || null,
        amount_total_mxn: order?.amount_total_mxn || null,
        role,
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, refund });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}