// src/app/api/orders/[id]/route.js
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

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeEmail(v) {
  return normEmail(v).trim().toLowerCase();
}

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizeDateOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseIntBounded(value, fallback, min, max) {
  const n = Math.floor(safeNum(value, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeMoneyValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeOrder(row) {
  if (!row || typeof row !== "object") return null;

  const out = { ...row };

  out.org_id = out.org_id || out.organization_id || null;
  out.organization_id = out.organization_id || out.org_id || null;

  for (const key of [
    "subtotal_cents",
    "discount_cents",
    "shipping_cents",
    "total_cents",
    "amount_subtotal_cents",
    "amount_shipping_cents",
    "amount_discount_cents",
    "amount_total_cents",
  ]) {
    if (key in out && out[key] !== null && out[key] !== undefined) {
      out[key] = normalizeMoneyValue(out[key]);
    }
  }

  if ("envia_cost_mxn" in out && out.envia_cost_mxn !== null && out.envia_cost_mxn !== undefined) {
    const n = Number(out.envia_cost_mxn);
    out.envia_cost_mxn = Number.isFinite(n) ? Number(n.toFixed(2)) : null;
  }

  if (out.customer_email) out.customer_email = normalizeEmail(out.customer_email);
  if (out.status) out.status = normalizeStatus(out.status);
  if (out.payment_status) out.payment_status = normalizeStatus(out.payment_status);
  if (out.shipping_status) out.shipping_status = normalizeStatus(out.shipping_status);
  if (out.shipment_status) out.shipment_status = normalizeStatus(out.shipment_status);

  return out;
}

function orgFilter(orgId) {
  return `org_id.eq.${orgId},organization_id.eq.${orgId}`;
}

function buildPatch(body = {}) {
  const patch = {};

  const textFields = [
    "status",
    "payment_status",
    "customer_name",
    "customer_email",
    "customer_phone",
    "shipping_country",
    "shipping_postal_code",
    "shipping_mode",
    "tracking_number",
    "carrier",
    "shipment_status",
    "shipping_status",
    "shipping_label_url",
    "items_summary",
    "notes",
  ];

  for (const key of textFields) {
    if (key in body) patch[key] = safeStr(body[key]).trim();
  }

  const numFields = [
    "subtotal_cents",
    "discount_cents",
    "shipping_cents",
    "total_cents",
    "amount_subtotal_cents",
    "amount_shipping_cents",
    "amount_discount_cents",
    "amount_total_cents",
  ];

  for (const key of numFields) {
    if (key in body) patch[key] = normalizeMoneyValue(body[key]);
  }

  for (const key of ["shipped_at", "fulfilled_at"]) {
    if (key in body) patch[key] = normalizeDateOrNull(body[key]);
  }

  if ("envia_cost_mxn" in body) {
    const n = Number(body.envia_cost_mxn);
    patch.envia_cost_mxn = Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  }

  if ("metadata" in body && body.metadata && typeof body.metadata === "object") {
    patch.metadata = body.metadata;
  }

  return patch;
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

function validatePatch(patch) {
  const out = { ...patch };

  if ("status" in out) {
    out.status = normalizeStatus(out.status);
    if (out.status && !allowedStatuses.has(out.status)) {
      throw new Error("status inválido");
    }
    if (!out.status) delete out.status;
  }

  if ("payment_status" in out) {
    out.payment_status = normalizeStatus(out.payment_status);
    if (out.payment_status && !allowedPaymentStatuses.has(out.payment_status)) {
      throw new Error("payment_status inválido");
    }
    if (!out.payment_status) delete out.payment_status;
  }

  if ("customer_email" in out) {
    const email = normalizeEmail(out.customer_email);
    out.customer_email = email || null;
  }

  if ("customer_phone" in out) {
    const phone = safeStr(out.customer_phone).replace(/\s+/g, " ").trim();
    out.customer_phone = phone || null;
  }

  if ("shipping_country" in out) {
    const c = safeStr(out.shipping_country).trim().toUpperCase();
    out.shipping_country = c || null;
  }

  if ("shipping_postal_code" in out) {
    const z = safeStr(out.shipping_postal_code).trim();
    out.shipping_postal_code = z || null;
  }

  if ("shipping_mode" in out) {
    const v = safeStr(out.shipping_mode).trim().toLowerCase();
    out.shipping_mode = v || null;
  }

  if ("tracking_number" in out) {
    const v = safeStr(out.tracking_number).trim();
    out.tracking_number = v || null;
  }

  if ("carrier" in out) {
    const v = safeStr(out.carrier).trim();
    out.carrier = v || null;
  }

  if ("shipment_status" in out) {
    const v = safeStr(out.shipment_status).trim().toLowerCase();
    out.shipment_status = v || null;
  }

  if ("shipping_status" in out) {
    const v = safeStr(out.shipping_status).trim().toLowerCase();
    out.shipping_status = v || null;
  }

  if ("shipping_label_url" in out) {
    const v = safeStr(out.shipping_label_url).trim();
    out.shipping_label_url = v || null;
  }

  if ("items_summary" in out) {
    const v = safeStr(out.items_summary).trim();
    out.items_summary = v || null;
  }

  if ("notes" in out) {
    const v = safeStr(out.notes).trim();
    out.notes = v || null;
  }

  return out;
}

async function resolveOrgId(sb, explicitOrgId) {
  const explicit = safeStr(explicitOrgId).trim();
  if (isUuid(explicit)) return explicit;

  const envId = safeStr(process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID || "").trim();
  if (isUuid(envId)) return envId;

  try {
    const { data: bySlug } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", "score-store")
      .limit(1)
      .maybeSingle();

    if (bySlug?.id) return bySlug.id;

    const { data: byName } = await sb
      .from("organizations")
      .select("id")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName?.id) return byName.id;

    const { data: anyOrg } = await sb
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (anyOrg?.id) return anyOrg.id;
  } catch {}

  return DEFAULT_SCORE_ORG_ID;
}

function getOrderIdFromParams(params) {
  return safeStr(params?.id).trim();
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "No autorizado" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "orders")) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

async function readOrder(sb, orgId, orderId) {
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .or(orgFilter(orgId))
    .maybeSingle();

  return { data, error };
}

async function updateOrder(sb, orgId, orderId, update) {
  const { data, error } = await sb
    .from("orders")
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .or(orgFilter(orgId))
    .select("*")
    .maybeSingle();

  return { data, error };
}

async function softDeleteOrder(sb, orgId, orderId) {
  const now = new Date().toISOString();

  const payload = {
    deleted_at: now,
    status: "cancelled",
    updated_at: now,
  };

  const { data, error } = await sb
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .or(orgFilter(orgId))
    .select("*")
    .maybeSingle();

  return { data, error, payload };
}

export async function GET(req, { params }) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);
    const orgId = await resolveOrgId(sb, url.searchParams.get("org_id") || url.searchParams.get("orgId") || "");
    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const id = getOrderIdFromParams(params);
    if (!isUuid(id)) return json({ ok: false, error: "Missing or invalid id" }, 400);

    const { data, error } = await readOrder(sb, orgId, id);
    if (error) {
      return json({ ok: false, error: error.message || "No se pudo leer el pedido" }, 500);
    }

    if (!data) {
      return json({ ok: false, error: "Order not found" }, 404);
    }

    return json({ ok: true, order: normalizeOrder(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);
    const orgId = await resolveOrgId(sb, url.searchParams.get("org_id") || url.searchParams.get("orgId") || "");
    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const id = getOrderIdFromParams(params);
    if (!isUuid(id)) return json({ ok: false, error: "Missing or invalid id" }, 400);

    const body = await req.json().catch(() => ({}));
    const patchSource = body?.patch && typeof body.patch === "object" ? body.patch : body;
    const patch = validatePatch(buildPatch(patchSource));

    if (!Object.keys(patch).length) {
      return json({ ok: false, error: "No fields to update" }, 400);
    }

    const { data: beforeRow, error: beforeErr } = await readOrder(sb, orgId, id);
    if (beforeErr) {
      return json({ ok: false, error: beforeErr.message || "No se pudo leer el pedido" }, 500);
    }

    if (!beforeRow?.id) {
      return json({ ok: false, error: "Order not found" }, 404);
    }

    const { data, error } = await updateOrder(sb, orgId, id, patch);
    if (error) {
      return json({ ok: false, error: error.message || "No se pudo actualizar el pedido" }, 500);
    }

    if (!data) {
      return json({ ok: false, error: "Order not found" }, 404);
    }

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normalizeEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "orders.update",
      entity: "orders",
      entity_id: id,
      summary: `Order updated (${patch.status || patch.payment_status || "no status change"})`,
      before: beforeRow,
      after: data,
      meta: {
        patch,
        role: auth.role,
        source: "api/orders/[id]/route",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json({ ok: true, order: normalizeOrder(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);
    const orgId = await resolveOrgId(sb, url.searchParams.get("org_id") || url.searchParams.get("orgId") || "");
    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    if (!["owner", "admin"].includes(auth.role)) {
      return json({ ok: false, error: "Permisos insuficientes" }, 403);
    }

    const id = getOrderIdFromParams(params);
    if (!isUuid(id)) return json({ ok: false, error: "Missing or invalid id" }, 400);

    const { data: beforeRow, error: beforeErr } = await readOrder(sb, orgId, id);
    if (beforeErr) {
      return json({ ok: false, error: beforeErr.message || "No se pudo leer el pedido" }, 500);
    }

    if (!beforeRow?.id) {
      return json({ ok: false, error: "Order not found" }, 404);
    }

    const { data, error, payload } = await softDeleteOrder(sb, orgId, id);
    if (error) {
      return json({ ok: false, error: error.message || "No se pudo cancelar el pedido" }, 500);
    }

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normalizeEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "orders.delete",
      entity: "orders",
      entity_id: id,
      summary: "Order soft-deleted and marked as cancelled",
      before: beforeRow,
      after: data || payload,
      meta: {
        role: auth.role,
        source: "api/orders/[id]/route",
        soft_delete: true,
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json({ ok: true, order: normalizeOrder(data || { ...beforeRow, ...payload }) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}