// src/app/api/stripe/refund/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg, applyOrgFilter } from "@/lib/dbScope";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
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

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !hasPerm(role, "orders")) {
      return json(403, { ok: false, error: "Permisos insuficientes." });
    }

    const readQ = sb
      .from("orders")
      .select("id, stripe_payment_intent_id, stripe_session_id, status, amount_total_mxn, org_id, organization_id")
      .eq("id", orderId);

    const { data: order, error: oErr } = await applyOrgFilter(readQ, orgId).maybeSingle();

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
    if (!res.ok) {
      return json(400, { ok: false, error: refund?.error?.message || "Stripe refund error." });
    }

    const before = { status: order?.status || null };

    const updateQ = sb
      .from("orders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    await applyOrgFilter(updateQ, orgId);

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