// src/app/api/orders/bulk-update/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg, applyOrgFilter } from "@/lib/dbScope";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (status, payload) => NextResponse.json(payload, { status, headers: noStoreHeaders });

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

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizePaymentStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function clampIds(arr, max = 200) {
  const out = [];
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v || "").trim();
    if (!isUuid(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
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

function buildPatch(body = {}) {
  const patch = {};

  if ("status" in body) patch.status = normalizeStatus(body.status);
  if ("payment_status" in body) patch.payment_status = normalizePaymentStatus(body.payment_status);

  if ("shipment_status" in body) patch.shipment_status = normalizeStatus(body.shipment_status);
  if ("shipping_status" in body) patch.shipping_status = normalizeStatus(body.shipping_status);

  if ("tracking_number" in body) patch.tracking_number = safeStr(body.tracking_number).trim();
  if ("carrier" in body) patch.carrier = safeStr(body.carrier).trim();
  if ("shipping_label_url" in body) patch.shipping_label_url = safeStr(body.shipping_label_url).trim();
  if ("notes" in body) patch.notes = safeStr(body.notes).trim();

  if ("fulfilled_at" in body) {
    const d = body.fulfilled_at ? new Date(body.fulfilled_at) : null;
    patch.fulfilled_at = d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }

  if ("shipped_at" in body) {
    const d = body.shipped_at ? new Date(body.shipped_at) : null;
    patch.shipped_at = d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }

  if ("envia_cost_mxn" in body) {
    const n = Number(body.envia_cost_mxn);
    patch.envia_cost_mxn = Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  }

  return patch;
}

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
    out.payment_status = normalizePaymentStatus(out.payment_status);
    if (out.payment_status && !allowedPaymentStatuses.has(out.payment_status)) {
      throw new Error("payment_status inválido");
    }
    if (!out.payment_status) delete out.payment_status;
  }

  for (const key of ["shipment_status", "shipping_status"]) {
    if (key in out) {
      out[key] = normalizeStatus(out[key]);
      if (!out[key]) delete out[key];
    }
  }

  for (const key of ["tracking_number", "carrier", "shipping_label_url", "notes"]) {
    if (key in out) {
      const v = safeStr(out[key]).trim();
      out[key] = v || null;
    }
  }

  if ("envia_cost_mxn" in out) {
    const n = Number(out.envia_cost_mxn);
    out.envia_cost_mxn = Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  }

  return out;
}

function normalizeRowsForAudit(rows) {
  return Array.isArray(rows) ? rows : [];
}

async function updateManyOrders(sb, orgId, ids, patch) {
  const query = sb
    .from("orders")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .select("id, org_id, organization_id, status, payment_status, shipment_status, shipping_status, tracking_number, carrier, shipping_label_url, updated_at");

  const { data, error } = await query;
  return { data, error };
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr || !user) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));

    const orgId = String(body?.org_id || body?.organization_id || "").trim();
    const ids = clampIds(body?.order_ids, 200);
    const rawPatch = body?.patch && typeof body.patch === "object" ? body.patch : body;

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });
    if (!ids.length) return json(400, { ok: false, error: "order_ids vacío" });

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !hasPerm(role, "orders")) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    const patch = validatePatch(buildPatch(rawPatch));
    if (!Object.keys(patch).length) {
      return json(400, { ok: false, error: "No hay campos válidos para actualizar" });
    }

    const { data, error } = await updateManyOrders(sb, orgId, ids, patch);
    if (error) {
      return json(500, { ok: false, error: error.message || "No se pudo actualizar" });
    }

    const updatedRows = normalizeRowsForAudit(data);

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "orders.bulk_update",
      entity: "orders",
      entity_id: String(ids.length),
      summary: `Bulk update ${ids.length} orders`,
      before: null,
      after: updatedRows,
      meta: {
        count: ids.length,
        patch,
        role,
        source: "api/orders/bulk-update",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, {
      ok: true,
      updated: Array.isArray(updatedRows) ? updatedRows.length : ids.length,
      ids,
      patch,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function PATCH(req) {
  return POST(req);
}