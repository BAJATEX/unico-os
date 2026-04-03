// src/app/api/envia/summary/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.*)$/i);
  return m ? m[1] : "";
}

const safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));

function clampInt(v, min, max, fallback = min) {
  const n = Math.floor(safeNum(v, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizeOrgId(input = "") {
  return safeStr(input).trim();
}

function parseOrgId(body = {}, url = null) {
  const fromBody = normalizeOrgId(body?.org_id || body?.organization_id || body?.orgId || "");
  if (fromBody) return fromBody;

  const fromQuery = url
    ? normalizeOrgId(url.searchParams.get("org_id") || url.searchParams.get("orgId") || "")
    : "";

  return fromQuery;
}

function parseDays(body = {}, url = null) {
  const fromBody = body?.days ?? body?.range ?? null;
  const fromQuery = url ? url.searchParams.get("days") || url.searchParams.get("range") : null;
  return clampInt(fromBody ?? fromQuery ?? 30, 1, 365, 30);
}

function canRead(role) {
  return ["owner", "admin", "marketing", "support", "ops", "operations", "finance"].includes(
    safeStr(role).toLowerCase()
  );
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "No autorizado" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !canRead(role) || !hasPerm(role, "dashboard")) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

function orgFilter(orgId) {
  return `org_id.eq.${orgId},organization_id.eq.${orgId}`;
}

function normalizeOrderRow(row) {
  if (!row || typeof row !== "object") return null;

  const amountCents =
    safeNum(row?.amount_total_cents, NaN) ||
    safeNum(row?.total_cents, NaN) ||
    safeNum(row?.subtotal_cents, NaN) ||
    0;

  return {
    id: safeStr(row?.id),
    status: normalizeStatus(row?.status || ""),
    payment_status: normalizeStatus(row?.payment_status || ""),
    customer_email: safeStr(row?.customer_email || row?.email || ""),
    amount_total_cents: Math.max(0, Math.round(amountCents)),
    amount_total_mxn: Math.round((Math.max(0, Math.round(amountCents)) / 100) * 100) / 100,
    stripe_session_id: safeStr(row?.stripe_session_id || row?.checkout_session_id || ""),
    tracking_number: safeStr(row?.tracking_number || ""),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    org_id: safeStr(row?.org_id || row?.organization_id || ""),
    organization_id: safeStr(row?.organization_id || row?.org_id || ""),
  };
}

function normalizeLabelRow(row) {
  if (!row || typeof row !== "object") return null;

  const cost =
    safeNum(row?.envia_cost_mxn, NaN) ||
    safeNum(row?.shipping_cost_mxn, NaN) ||
    0;

  return {
    id: safeStr(row?.id),
    status: normalizeStatus(row?.status || row?.shipment_status || row?.shipping_status || ""),
    shipment_status: normalizeStatus(row?.shipment_status || ""),
    shipping_status: normalizeStatus(row?.shipping_status || ""),
    carrier: safeStr(row?.carrier || ""),
    service: safeStr(row?.service || ""),
    tracking_number: safeStr(row?.tracking_number || ""),
    label_url: safeStr(row?.label_url || ""),
    envia_cost_mxn: Math.round((Math.max(0, cost) + Number.EPSILON) * 100) / 100,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    order_id: row?.order_id || null,
    org_id: safeStr(row?.org_id || row?.organization_id || ""),
    organization_id: safeStr(row?.organization_id || row?.org_id || ""),
  };
}

function summarizeOrders(rows = []) {
  const orders = Array.isArray(rows) ? rows.filter(Boolean).map(normalizeOrderRow).filter(Boolean) : [];

  const shipped = orders.filter((o) => ["shipped", "fulfilled", "delivered"].includes(o.status || ""));
  const pending = orders.filter((o) =>
    ["pending", "pending_payment", "payment_failed"].includes(o.status || "")
  );
  const withTracking = orders.filter((o) => Boolean(o.tracking_number));
  const paid = orders.filter((o) => o.status === "paid" || o.payment_status === "paid");

  const valueMXN = orders.reduce((acc, o) => acc + safeNum(o.amount_total_mxn, 0), 0);

  return {
    total_orders: orders.length,
    paid_orders: paid.length,
    shipped_orders: shipped.length,
    pending_orders: pending.length,
    tracked_orders: withTracking.length,
    value_mxn: Math.round(valueMXN * 100) / 100,
    recent_orders: orders.slice(0, 10),
  };
}

function summarizeLabels(rows = []) {
  const labels = Array.isArray(rows) ? rows.filter(Boolean).map(normalizeLabelRow).filter(Boolean) : [];

  const generated = labels.filter((l) => Boolean(l.label_url));
  const pending = labels.filter((l) => !l.label_url && ["pending", ""].includes(l.status || ""));
  const inTransit = labels.filter((l) =>
    ["shipped", "in_transit", "transit", "delivered"].includes(l.status || l.shipment_status || "")
  );
  const totalCost = labels.reduce((acc, l) => acc + safeNum(l.envia_cost_mxn, 0), 0);

  return {
    total_labels: labels.length,
    generated_labels: generated.length,
    pending_labels: pending.length,
    in_transit_labels: inTransit.length,
    total_envia_cost_mxn: Math.round(totalCost * 100) / 100,
    recent_labels: labels.slice(0, 10),
  };
}

async function fetchOrders(sb, orgId, days) {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - days);

  const { data, error } = await sb
    .from("orders")
    .select(
      [
        "id",
        "status",
        "payment_status",
        "amount_total_cents",
        "total_cents",
        "subtotal_cents",
        "amount_total_mxn",
        "customer_email",
        "stripe_session_id",
        "checkout_session_id",
        "tracking_number",
        "created_at",
        "updated_at",
        "org_id",
        "organization_id",
      ].join(", ")
    )
    .or(orgFilter(orgId))
    .gte("created_at", limitDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchLabels(sb, orgId, days) {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - days);

  const { data, error } = await sb
    .from("shipping_labels")
    .select(
      [
        "id",
        "status",
        "shipment_status",
        "shipping_status",
        "envia_cost_mxn",
        "tracking_number",
        "carrier",
        "service",
        "label_url",
        "order_id",
        "created_at",
        "updated_at",
        "org_id",
        "organization_id",
      ].join(", ")
    )
    .or(orgFilter(orgId))
    .gte("created_at", limitDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);
    const orgId = parseOrgId({}, url);
    const days = parseDays({}, url);

    if (!isUuid(orgId)) {
      return json({ ok: false, error: "org_id inválido" }, 400);
    }

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const [orders, labels] = await Promise.all([fetchOrders(sb, orgId, days), fetchLabels(sb, orgId, days)]);

    const ordersSummary = summarizeOrders(orders);
    const labelsSummary = summarizeLabels(labels);

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "envia.summary.read",
      entity: "shipping_labels",
      entity_id: String(labelsSummary.total_labels),
      summary: `Read Envía summary for ${days} days`,
      meta: {
        days,
        role: auth.role,
        orders: ordersSummary.total_orders,
        labels: labelsSummary.total_labels,
        source: "api/envia/summary",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json({
      ok: true,
      org_id: orgId,
      role: auth.role,
      days,
      counts: {
        orders: ordersSummary.total_orders,
        shipping_labels: labelsSummary.total_labels,
        recent_orders: ordersSummary.recent_orders.length,
        recent_labels: labelsSummary.recent_labels.length,
      },
      orders: ordersSummary,
      shipping_labels: labelsSummary,
      recent_orders: ordersSummary.recent_orders,
      recent_labels: labelsSummary.recent_labels,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}

export async function POST(req) {
  return GET(req);
}