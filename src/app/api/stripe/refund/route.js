// src/app/api/stripe/refund/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg } from "@/lib/dbScope";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (status, payload) =>
  NextResponse.json(payload, { status, headers: noStoreHeaders });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function normalizeEmail(v) {
  return normEmail(v).trim().toLowerCase();
}

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizeMoneyCents(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function orgFilter(orgId) {
  return `org_id.eq.${orgId},organization_id.eq.${orgId}`;
}

function buildRefundUrl() {
  return "https://api.stripe.com/v1/refunds";
}

function getStripeKey() {
  const key = safeStr(process.env.STRIPE_SECRET_KEY || "").trim();
  return key || "";
}

function canRefund(role) {
  return hasPerm(role, "orders") && ["owner", "admin", "finance"].includes(String(role || "").toLowerCase());
}

async function readOrder(sb, orgId, orderId) {
  const { data, error } = await sb
    .from("orders")
    .select(
      [
        "id",
        "status",
        "payment_status",
        "amount_total_mxn",
        "amount_total_cents",
        "total_cents",
        "stripe_payment_intent_id",
        "stripe_session_id",
        "org_id",
        "organization_id",
        "updated_at",
      ].join(", ")
    )
    .eq("id", orderId)
    .or(orgFilter(orgId))
    .maybeSingle();

  return { data, error };
}

async function markRefunded(sb, orgId, orderId) {
  const update = {
    status: "refunded",
    payment_status: "refunded",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .or(orgFilter(orgId))
    .select("*")
    .maybeSingle();

  return { data, error };
}

async function handleRefund(req) {
  const stripeKey = getStripeKey();
  if (!stripeKey) {
    return json(400, { ok: false, error: "Falta STRIPE_SECRET_KEY." });
  }

  const sb = serverSupabase();
  const token = getBearerToken(req);

  const { user, error: authErr } = await requireUserFromToken(sb, token);
  if (authErr || !user) {
    return json(401, { ok: false, error: "No autorizado" });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = safeStr(body?.org_id || body?.organization_id || "").trim();
  const orderId = safeStr(body?.order_id || body?.id || "").trim();
  const reason = safeStr(body?.reason || body?.note || body?.summary || "").trim();

  if (!isUuid(orgId)) {
    return json(400, { ok: false, error: "org_id inválido." });
  }

  if (!isUuid(orderId)) {
    return json(400, { ok: false, error: "order_id requerido o inválido." });
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !canRefund(role)) {
    return json(403, { ok: false, error: "Permisos insuficientes." });
  }

  const { data: order, error: orderErr } = await readOrder(sb, orgId, orderId);
  if (orderErr) {
    return json(500, { ok: false, error: orderErr.message || "No se pudo leer el pedido." });
  }

  if (!order?.id) {
    return json(404, { ok: false, error: "Pedido no encontrado." });
  }

  const currentStatus = normalizeStatus(order?.status);
  const currentPaymentStatus = normalizeStatus(order?.payment_status);
  if (currentStatus === "refunded" || currentPaymentStatus === "refunded") {
    return json(409, {
      ok: false,
      error: "El pedido ya está reembolsado.",
    });
  }

  const paymentIntent = safeStr(order?.stripe_payment_intent_id || "").trim();
  if (!paymentIntent) {
    return json(400, {
      ok: false,
      error: "Este pedido no tiene stripe_payment_intent_id en la base de datos.",
    });
  }

  const refundBody = new URLSearchParams();
  refundBody.set("payment_intent", paymentIntent);

  const requestHeaders = {
    Authorization: `Bearer ${stripeKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Idempotency-Key": `refund-${orderId}`,
  };

  if (reason) {
    refundBody.set("reason", "requested_by_customer");
  }

  const stripeRes = await fetch(buildRefundUrl(), {
    method: "POST",
    headers: requestHeaders,
    body: refundBody.toString(),
  });

  const refund = await stripeRes.json().catch(() => null);
  if (!stripeRes.ok) {
    return json(400, {
      ok: false,
      error: refund?.error?.message || "Stripe refund error.",
      stripe: refund || null,
    });
  }

  const before = {
    status: order?.status || null,
    payment_status: order?.payment_status || null,
    amount_total_mxn: normalizeMoneyCents(order?.amount_total_mxn),
    amount_total_cents: normalizeMoneyCents(order?.amount_total_cents || order?.total_cents),
    stripe_payment_intent_id: paymentIntent,
    stripe_session_id: safeStr(order?.stripe_session_id || ""),
  };

  const { data: updatedOrder, error: updateErr } = await markRefunded(sb, orgId, orderId);
  if (updateErr) {
    return json(500, {
      ok: false,
      error: updateErr.message || "No se pudo actualizar el pedido a refunded.",
      refund,
    });
  }

  await writeAudit(sb, {
    organization_id: orgId,
    actor_email: normalizeEmail(user?.email),
    actor_user_id: user?.id || null,
    action: "stripe.refund",
    entity: "orders",
    entity_id: orderId,
    summary: reason
      ? `Refund created and order marked as refunded · ${reason}`
      : "Refund created and order marked as refunded",
    before,
    after: {
      status: "refunded",
      payment_status: "refunded",
      stripe_refund_id: refund?.id || null,
    },
    meta: {
      refund_id: refund?.id || null,
      refund_status: refund?.status || null,
      payment_intent: paymentIntent,
      stripe_session_id: order?.stripe_session_id || null,
      amount_total_mxn: before.amount_total_mxn,
      amount_total_cents: before.amount_total_cents,
      reason: reason || null,
      role,
      source: "api/stripe/refund",
    },
    ip: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  return json(200, {
    ok: true,
    refund,
    order: updatedOrder || {
      ...order,
      status: "refunded",
      payment_status: "refunded",
    },
  });
}

export async function POST(req) {
  try {
    return await handleRefund(req);
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function PATCH(req) {
  try {
    return await handleRefund(req);
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}