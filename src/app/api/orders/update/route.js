// src/app/api/orders/update/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { applyOrgFilter, getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function json(status, payload) {
  return NextResponse.json(payload, { status, headers: noStoreHeaders });
}

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

function clampInt(v, min, max) {
  const n = Math.floor(safeNum(v, min));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeEmail(v) {
  return normEmail(v).trim().toLowerCase();
}

function normalizeDateOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeMoneyFields(update) {
  const keys = [
    "subtotal_cents",
    "discount_cents",
    "shipping_cents",
    "total_cents",
    "amount_subtotal_cents",
    "amount_shipping_cents",
    "amount_discount_cents",
    "amount_total_cents",
  ];

  for (const key of keys) {
    if (key in update) update[key] = Math.max(0, clampInt(update[key], 0, 2147483647));
  }

  return update;
}

function pickPatch(body = {}) {
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
    "notes",
  ];

  for (const key of textFields) {
    if (key in body) patch[key] = safeStr(body[key]).trim();
  }

  const numericFields = [
    "subtotal_cents",
    "discount_cents",
    "shipping_cents",
    "total_cents",
    "amount_subtotal_cents",
    "amount_shipping_cents",
    "amount_discount_cents",
    "amount_total_cents",
  ];

  for (const key of numericFields) {
    if (key in body) patch[key] = Math.max(0, clampInt(body[key], 0, 2147483647));
  }

  const dateFields = ["shipped_at", "fulfilled_at"];
  for (const key of dateFields) {
    if (key in body) patch[key] = normalizeDateOrNull(body[key]);
  }

  if ("envia_cost_mxn" in body) {
    const n = Number(body.envia_cost_mxn);
    patch.envia_cost_mxn = Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  }

  return patch;
}

function normalizeStatus(value) {
  return safeStr(value).trim().toLowerCase();
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

  if ("notes" in out) {
    const v = safeStr(out.notes).trim();
    out.notes = v || null;
  }

  return out;
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
      const n = Number(out[key]);
      out[key] = Number.isFinite(n) ? Math.round(n) : 0;
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

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "orders")) {
    return { ok: false, res: json(403, { ok: false, error: "Permisos insuficientes" }) };
  }

  return { ok: true, user, role };
}

async function readOrder(sb, orgId, orderId) {
  const q = sb.from("orders").select("*").eq("id", orderId).limit(1);
  const filtered = applyOrgFilter(q, orgId);
  const { data, error } = await filtered.maybeSingle();
  return { data, error };
}

async function updateOrder(sb, orgId, orderId, update) {
  const q = sb
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select("*")
    .limit(1);

  const filtered = applyOrgFilter(q, orgId);
  const { data, error } = await filtered.maybeSingle();
  return { data, error };
}

async function handleUpdate(req) {
  const sb = serverSupabase();

  const body = await req.json().catch(() => ({}));
  const orgId = safeStr(body?.org_id || body?.organization_id || "").trim();
  const orderId = safeStr(body?.order_id || body?.id || "").trim();

  if (!isUuid(orgId)) {
    return json(400, { ok: false, error: "org_id inválido" });
  }

  if (!isUuid(orderId)) {
    return json(400, { ok: false, error: "order_id inválido" });
  }

  const auth = await authorize(req, sb, orgId);
  if (!auth.ok) return auth.res;

  const beforeRes = await readOrder(sb, orgId, orderId);
  if (beforeRes.error) {
    return json(500, { ok: false, error: beforeRes.error.message || "No se pudo leer el pedido" });
  }

  const beforeRow = beforeRes.data;
  if (!beforeRow) {
    return json(404, { ok: false, error: "Pedido no encontrado" });
  }

  const rawPatch = body?.patch && typeof body.patch === "object" ? body.patch : body;
  const patch = validatePatch(pickPatch(rawPatch));

  if (Object.keys(patch).length === 0) {
    return json(400, { ok: false, error: "No hay campos válidos para actualizar" });
  }

  const update = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  normalizeMoneyFields(update);

  const afterRes = await updateOrder(sb, orgId, orderId, update);
  if (afterRes.error) {
    return json(500, { ok: false, error: afterRes.error.message || "No se pudo actualizar el pedido" });
  }

  const afterRow = afterRes.data;
  if (!afterRow) {
    return json(500, { ok: false, error: "La actualización no devolvió el pedido" });
  }

  await writeAudit(sb, {
    organization_id: orgId,
    actor_email: normEmail(auth.user?.email),
    actor_user_id: auth.user?.id || null,
    action: "orders.update",
    entity: "orders",
    entity_id: orderId,
    summary: `Order updated (${patch.status || patch.payment_status || "no status change"})`,
    before: beforeRow,
    after: afterRow,
    meta: {
      patch,
      role: auth.role,
      source: "api/orders/update",
    },
    ip: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  return json(200, {
    ok: true,
    order: normalizeOrder(afterRow),
  });
}

export async function POST(req) {
  try {
    return await handleUpdate(req);
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function PATCH(req) {
  try {
    return await handleUpdate(req);
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}