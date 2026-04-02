// src/app/api/orders/[id]/status/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

const DEFAULT_SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizeEmail(v) {
  return normEmail(v).trim().toLowerCase();
}

function parseStatusInput(body = {}) {
  const raw = body?.status ?? body?.patch?.status ?? body?.next_status ?? body?.nextStatus ?? null;
  const status = normalizeStatus(raw);
  return status || null;
}

function parsePaymentStatusInput(body = {}) {
  const raw =
    body?.payment_status ??
    body?.patch?.payment_status ??
    body?.paymentStatus ??
    body?.next_payment_status ??
    null;
  const paymentStatus = normalizeStatus(raw);
  return paymentStatus || null;
}

const allowedStatuses = new Set([
  "pending",
  "pending_payment",
  "paid",
  "payment_failed",
  "fulfilled",
  "cancelled",
  "refunded",
]);

const allowedPaymentStatuses = new Set([
  "unpaid",
  "pending",
  "paid",
  "partially_paid",
  "failed",
  "refunded",
  "disputed",
  "void",
]);

async function resolveOrgId(sb, explicitOrgId = "") {
  const explicit = safeStr(explicitOrgId).trim();
  if (isUuid(explicit)) return explicit;

  const envId = safeStr(process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID || "").trim();
  if (isUuid(envId)) return envId;

  try {
    const { data: byId } = await sb
      .from("organizations")
      .select("id")
      .eq("id", DEFAULT_SCORE_ORG_ID)
      .limit(1)
      .maybeSingle();

    if (byId?.id) return DEFAULT_SCORE_ORG_ID;

    const { data: byName } = await sb
      .from("organizations")
      .select("id")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName?.id) return byName.id;
  } catch {}

  return DEFAULT_SCORE_ORG_ID;
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "Unauthorized" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "orders")) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

function buildOrderQuery(sb, orgId, orderId) {
  return sb
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .maybeSingle();
}

function buildUpdatePayload(status, paymentStatus) {
  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (status) payload.status = status;
  if (paymentStatus) payload.payment_status = paymentStatus;

  if (status === "cancelled") {
    payload.shipment_status = "cancelled";
    payload.shipping_status = "cancelled";
  }

  if (status === "refunded") {
    payload.payment_status = "refunded";
  }

  if (status === "paid" && !paymentStatus) {
    payload.payment_status = "paid";
  }

  return payload;
}

function normalizeOrder(row) {
  if (!row || typeof row !== "object") return null;

  const out = { ...row };
  out.org_id = out.org_id || out.organization_id || null;
  out.organization_id = out.organization_id || out.org_id || null;

  if (out.status) out.status = normalizeStatus(out.status);
  if (out.payment_status) out.payment_status = normalizeStatus(out.payment_status);
  if (out.shipping_status) out.shipping_status = normalizeStatus(out.shipping_status);
  if (out.shipment_status) out.shipment_status = normalizeStatus(out.shipment_status);
  if (out.customer_email) out.customer_email = normalizeEmail(out.customer_email);

  return out;
}

async function handleStatusUpdate(req, params) {
  const sb = serverSupabase();
  const url = new URL(req.url);
  const orgId = await resolveOrgId(
    sb,
    url.searchParams.get("org_id") ||
      url.searchParams.get("orgId") ||
      ""
  );

  const auth = await authorize(req, sb, orgId);
  if (!auth.ok) return auth.res;

  const orderId = safeStr(params?.id).trim();
  if (!isUuid(orderId)) {
    return json({ ok: false, error: "Missing or invalid id" }, 400);
  }

  const body = await req.json().catch(() => ({}));
  const nextStatus = parseStatusInput(body);
  const nextPaymentStatus = parsePaymentStatusInput(body);

  if (!nextStatus && !nextPaymentStatus) {
    return json({ ok: false, error: "No status to update" }, 400);
  }

  if (nextStatus && !allowedStatuses.has(nextStatus)) {
    return json({ ok: false, error: "status inválido" }, 400);
  }

  if (nextPaymentStatus && !allowedPaymentStatuses.has(nextPaymentStatus)) {
    return json({ ok: false, error: "payment_status inválido" }, 400);
  }

  const { data: beforeRow, error: beforeErr } = await buildOrderQuery(sb, orgId, orderId);
  if (beforeErr) {
    return json({ ok: false, error: beforeErr.message || "No se pudo leer el pedido" }, 500);
  }

  if (!beforeRow?.id) {
    return json({ ok: false, error: "Order not found" }, 404);
  }

  const update = buildUpdatePayload(nextStatus, nextPaymentStatus);

  const { data: afterRow, error: updateErr } = await sb
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .select("*")
    .maybeSingle();

  if (updateErr) {
    return json({ ok: false, error: updateErr.message || "No se pudo actualizar el pedido" }, 500);
  }

  if (!afterRow?.id) {
    return json({ ok: false, error: "Order not found" }, 404);
  }

  await writeAudit(sb, {
    organization_id: orgId,
    actor_email: normalizeEmail(auth.user?.email),
    actor_user_id: auth.user?.id || null,
    action: "orders.status.update",
    entity: "orders",
    entity_id: orderId,
    summary: `Order status changed to ${nextStatus || beforeRow?.status || "unknown"}`,
    before: beforeRow,
    after: afterRow,
    meta: {
      role: auth.role,
      status: nextStatus || null,
      payment_status: nextPaymentStatus || null,
      source: "api/orders/[id]/status",
    },
    ip: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  return json({
    ok: true,
    order: normalizeOrder(afterRow),
  });
}

export async function POST(req, { params }) {
  try {
    return await handleStatusUpdate(req, params);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    return await handleStatusUpdate(req, params);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}