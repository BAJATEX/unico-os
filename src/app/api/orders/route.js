// src/app/api/orders/route.js
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

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizeMoneyToCents(row) {
  const fromCents =
    safeNum(row?.amount_total_cents, NaN) ||
    safeNum(row?.total_cents, NaN) ||
    safeNum(row?.total_amount_cents, NaN);

  if (Number.isFinite(fromCents) && fromCents > 0) return Math.round(fromCents);

  const fromMxn =
    safeNum(row?.amount_total_mxn, NaN) ||
    safeNum(row?.total_amount_mxn, NaN) ||
    safeNum(row?.subtotal_mxn, NaN);

  if (Number.isFinite(fromMxn) && fromMxn > 0) return Math.round(fromMxn * 100);

  return 0;
}

function normalizeOrder(row) {
  if (!row || typeof row !== "object") return null;

  const totalCents = normalizeMoneyToCents(row);
  const shippingCents =
    safeNum(row?.shipping_cents, NaN) ||
    Math.round(safeNum(row?.shipping_total_mxn, NaN) * 100) ||
    Math.round(safeNum(row?.amount_shipping_mxn, NaN) * 100) ||
    0;

  const discountCents =
    safeNum(row?.discount_cents, NaN) ||
    Math.round(safeNum(row?.amount_discount_mxn, NaN) * 100) ||
    0;

  return {
    id: safeStr(row?.id),
    order_number: safeStr(row?.order_number || row?.number || row?.reference || row?.id),
    org_id: safeStr(row?.org_id || row?.organization_id || ""),
    organization_id: safeStr(row?.organization_id || row?.org_id || ""),
    stripe_session_id: safeStr(row?.stripe_session_id || row?.checkout_session_id || row?.session_id),
    checkout_session_id: safeStr(row?.checkout_session_id || row?.stripe_session_id || row?.session_id),
    customer_name: safeStr(row?.customer_name || row?.name),
    customer_email: safeStr(row?.customer_email || row?.email),
    customer_phone: safeStr(row?.customer_phone || row?.phone),
    shipping_country: safeStr(row?.shipping_country || ""),
    shipping_postal_code: safeStr(row?.shipping_postal_code || ""),
    status: normalizeStatus(row?.status || "pending"),
    payment_status: normalizeStatus(row?.payment_status || ""),
    shipping_mode: safeStr(row?.shipping_mode || ""),
    shipping_mode_label:
      safeStr(row?.shipping_mode || "") === "pickup"
        ? "Pickup"
        : safeStr(row?.shipping_mode || "") === "delivery"
          ? "Envío"
          : safeStr(row?.shipping_mode || ""),
    total_cents: totalCents,
    total_mxn: totalCents / 100,
    subtotal_cents:
      safeNum(row?.subtotal_cents, NaN) ||
      Math.round(safeNum(row?.amount_subtotal_mxn, NaN) * 100) ||
      0,
    discount_cents: discountCents,
    shipping_cents: shippingCents,
    shipping_mxn: shippingCents / 100,
    amount_subtotal_cents:
      safeNum(row?.amount_subtotal_cents, NaN) ||
      safeNum(row?.subtotal_cents, NaN) ||
      0,
    amount_shipping_cents:
      safeNum(row?.amount_shipping_cents, NaN) ||
      safeNum(row?.shipping_cents, NaN) ||
      0,
    amount_discount_cents:
      safeNum(row?.amount_discount_cents, NaN) ||
      safeNum(row?.discount_cents, NaN) ||
      0,
    amount_total_cents:
      safeNum(row?.amount_total_cents, NaN) ||
      safeNum(row?.total_cents, NaN) ||
      totalCents,
    items_summary: safeStr(row?.items_summary || ""),
    items_json: row?.items_json ?? null,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    tracking_number: safeStr(row?.tracking_number || row?.tracking || ""),
    carrier: safeStr(row?.carrier || ""),
    shipping_label_url: safeStr(row?.shipping_label_url || row?.label_url || ""),
    shipment_status: normalizeStatus(row?.shipment_status || ""),
    shipping_status: normalizeStatus(row?.shipping_status || ""),
    fulfilled_at: row?.fulfilled_at || null,
    shipped_at: row?.shipped_at || null,
    deleted_at: row?.deleted_at || null,
    raw: row,
  };
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

    const { data: byAny } = await sb
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byAny?.id) return byAny.id;
  } catch {}

  return DEFAULT_SCORE_ORG_ID;
}

function parseIntBounded(value, fallback, min, max) {
  const n = Math.floor(safeNum(value, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildSearchHaystack(row) {
  return [
    row?.id,
    row?.order_number,
    row?.stripe_session_id,
    row?.checkout_session_id,
    row?.session_id,
    row?.customer_name,
    row?.customer_email,
    row?.customer_phone,
    row?.status,
    row?.payment_status,
    row?.tracking_number,
    row?.carrier,
    row?.shipping_mode,
    row?.shipping_postal_code,
  ]
    .map((x) => safeStr(x).toLowerCase())
    .join("|");
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);
  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "Unauthorized" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !["owner", "admin", "marketing", "ops"].includes(role)) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

function orgFilter(orgId) {
  return `org_id.eq.${orgId},organization_id.eq.${orgId}`;
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);

    const explicitOrgId = safeStr(url.searchParams.get("org_id") || url.searchParams.get("orgId")).trim();
    const orgId = await resolveOrgId(sb, explicitOrgId);

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const status = safeStr(url.searchParams.get("status")).trim();
    const q = safeStr(url.searchParams.get("q")).trim().toLowerCase();
    const limit = parseIntBounded(url.searchParams.get("limit"), 50, 1, 200);
    const offset = parseIntBounded(url.searchParams.get("offset"), 0, 0, 100000);
    const days = parseIntBounded(url.searchParams.get("days"), 90, 1, 365);

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const { data, error } = await sb
      .from("orders")
      .select("*")
      .or(orgFilter(orgId))
      .gte("created_at", dateLimit.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return json({ ok: false, error: error.message || "No se pudieron cargar pedidos" }, 500);
    }

    let rows = Array.isArray(data) ? data : [];

    if (status) {
      const target = status.toLowerCase();
      rows = rows.filter((r) => normalizeStatus(r?.status || r?.payment_status || "") === target);
    }

    if (q) {
      rows = rows.filter((r) => buildSearchHaystack(r).includes(q));
    }

    rows = rows
      .filter((r) => r?.deleted_at == null)
      .map(normalizeOrder)
      .filter(Boolean);

    const total = rows.length;
    const pageRows = rows.slice(offset, offset + limit);

    return json({
      ok: true,
      org_id: orgId,
      role: auth.role,
      total,
      offset,
      limit,
      items: pageRows,
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const body = await req.json().catch(() => ({}));

    const explicitOrgId = safeStr(body?.org_id || body?.organization_id || "").trim();
    const orgId = await resolveOrgId(sb, explicitOrgId);

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const items = Array.isArray(body?.items) ? body.items : [];
    const limit = parseIntBounded(body?.limit, 50, 1, 200);
    const offset = parseIntBounded(body?.offset, 0, 0, 100000);
    const status = safeStr(body?.status).trim().toLowerCase();
    const q = safeStr(body?.q).trim().toLowerCase();
    const days = parseIntBounded(body?.days, 90, 1, 365);

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const { data, error } = await sb
      .from("orders")
      .select("*")
      .or(orgFilter(orgId))
      .gte("created_at", dateLimit.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return json({ ok: false, error: error.message || "No se pudieron cargar pedidos" }, 500);
    }

    let rows = Array.isArray(data) ? data : [];

    if (status) {
      rows = rows.filter((r) => normalizeStatus(r?.status || r?.payment_status || "") === status);
    }

    if (q) {
      rows = rows.filter((r) => buildSearchHaystack(r).includes(q));
    }

    rows = rows.filter((r) => r?.deleted_at == null).map(normalizeOrder).filter(Boolean);

    const total = rows.length;
    const pageRows = rows.slice(offset, offset + limit);

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "orders.list",
      entity: "orders",
      entity_id: String(pageRows.length),
      summary: `Listed ${pageRows.length} orders`,
      meta: {
        total,
        offset,
        limit,
        status: status || null,
        q: q || null,
        days,
        items_count: items.length,
        role: auth.role,
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json({
      ok: true,
      org_id: orgId,
      role: auth.role,
      total,
      offset,
      limit,
      items: pageRows,
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}