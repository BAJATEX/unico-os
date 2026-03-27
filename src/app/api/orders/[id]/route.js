export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid } from "@/lib/dbScope";

const DEFAULT_SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));

const safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const getBearerToken = (req) => {
  const h = req.headers.get("authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.*)$/i);
  return m ? m[1] : "";
};

const resolveOrgId = async (sb, explicitOrgId = "") => {
  const envId = explicitOrgId || process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID;
  if (envId && isUuid(envId)) return String(envId).trim();

  let orgId = DEFAULT_SCORE_ORG_ID;

  try {
    const { data: byId } = await sb.from("organizations").select("id").eq("id", orgId).limit(1).maybeSingle();
    if (byId?.id) return orgId;

    const { data: byName } = await sb
      .from("organizations")
      .select("id")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName?.id) orgId = byName.id;
  } catch {}

  return orgId;
};

const normalizeOrder = (row) => {
  const totalCents =
    safeNum(row?.amount_total_cents, NaN) ||
    safeNum(row?.total_cents, NaN) ||
    safeNum(row?.total_amount_cents, NaN) ||
    Math.round(safeNum(row?.amount_total_mxn, NaN) * 100) ||
    Math.round(safeNum(row?.total_amount_mxn, NaN) * 100) ||
    0;

  return {
    id: safeStr(row?.id),
    order_number: safeStr(row?.order_number || row?.number || row?.reference || row?.id),
    stripe_session_id: safeStr(row?.stripe_session_id || row?.checkout_session_id || row?.session_id),
    customer_name: safeStr(row?.customer_name || row?.name),
    customer_email: safeStr(row?.customer_email || row?.email),
    customer_phone: safeStr(row?.customer_phone || row?.phone),
    status: safeStr(row?.status || "pending"),
    payment_status: safeStr(row?.payment_status || ""),
    shipping_mode: safeStr(row?.shipping_mode || ""),
    total_cents: totalCents,
    total_mxn: totalCents / 100,
    shipping_cents:
      safeNum(row?.shipping_cents, NaN) ||
      Math.round(safeNum(row?.shipping_total_mxn, NaN) * 100) ||
      0,
    shipping_mxn:
      (safeNum(row?.shipping_cents, NaN) || Math.round(safeNum(row?.shipping_total_mxn, NaN) * 100) || 0) / 100,
    items_summary: safeStr(row?.items_summary || ""),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    tracking_number: safeStr(row?.tracking_number || row?.tracking || ""),
    shipping_label_url: safeStr(row?.shipping_label_url || ""),
    raw: row,
  };
};

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);
  if (authErr || !user) return { ok: false, res: json({ ok: false, error: "Unauthorized" }, 401) };

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !["owner", "admin", "marketing", "ops"].includes(role)) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

export async function GET(req, { params }) {
  try {
    const sb = serverSupabase();
    const orgId = await resolveOrgId(sb, new URL(req.url).searchParams.get("org_id") || "");

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const id = safeStr(params?.id).trim();
    if (!id) return json({ ok: false, error: "Missing id" }, 400);

    const { data, error } = await sb
      .from("orders")
      .select("*")
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message || "No se pudo leer el pedido" }, 500);
    if (!data) return json({ ok: false, error: "Order not found" }, 404);

    return json({ ok: true, order: normalizeOrder(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const sb = serverSupabase();
    const orgId = await resolveOrgId(sb, new URL(req.url).searchParams.get("org_id") || "");

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const id = safeStr(params?.id).trim();
    if (!id) return json({ ok: false, error: "Missing id" }, 400);

    const body = await req.json().catch(() => ({}));
    const patch = {};

    const allow = [
      "status",
      "payment_status",
      "customer_name",
      "customer_email",
      "customer_phone",
      "shipping_mode",
      "tracking_number",
      "tracking",
      "shipping_label_url",
      "items_summary",
      "notes",
    ];

    for (const key of allow) {
      if (key in body) patch[key] = safeStr(body[key]);
    }

    if ("total_cents" in body) patch.total_cents = Math.max(0, Math.floor(safeNum(body.total_cents)));
    if ("amount_total_cents" in body) patch.amount_total_cents = Math.max(0, Math.floor(safeNum(body.amount_total_cents)));
    if ("shipping_cents" in body) patch.shipping_cents = Math.max(0, Math.floor(safeNum(body.shipping_cents)));

    if (!Object.keys(patch).length) {
      return json({ ok: false, error: "No fields to update" }, 400);
    }

    const tryUpdate = async (payload) =>
      sb
        .from("orders")
        .update(payload)
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .eq("id", id)
        .select("*")
        .limit(1)
        .maybeSingle();

    let result = await tryUpdate({ ...patch, updated_at: new Date().toISOString() });

    if (result?.error && /deleted_at|column/i.test(result.error.message || "")) {
      result = await tryUpdate({ ...patch });
    }

    const { data, error } = result;

    if (error) return json({ ok: false, error: error.message || "No se pudo actualizar el pedido" }, 500);
    if (!data) return json({ ok: false, error: "Order not found" }, 404);

    return json({ ok: true, order: normalizeOrder(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const sb = serverSupabase();
    const orgId = await resolveOrgId(sb, new URL(req.url).searchParams.get("org_id") || "");

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const id = safeStr(params?.id).trim();
    if (!id) return json({ ok: false, error: "Missing id" }, 400);

    const role = auth.role;
    if (!["owner", "admin"].includes(role)) {
      return json({ ok: false, error: "Permisos insuficientes" }, 403);
    }

    const now = new Date().toISOString();

    let result = await sb
      .from("orders")
      .update({ deleted_at: now, status: "cancelled", updated_at: now })
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .eq("id", id)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (result?.error && /deleted_at|column/i.test(result.error.message || "")) {
      result = await sb
        .from("orders")
        .update({ status: "cancelled", updated_at: now })
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .eq("id", id)
        .select("*")
        .limit(1)
        .maybeSingle();
    }

    const { data, error } = result;

    if (error) return json({ ok: false, error: error.message || "No se pudo eliminar el pedido" }, 500);
    if (!data) return json({ ok: false, error: "Order not found" }, 404);

    return json({ ok: true, order: normalizeOrder(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}