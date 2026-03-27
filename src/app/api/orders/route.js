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
    shipping_mode_label:
      safeStr(row?.shipping_mode || "") === "pickup"
        ? "Pickup"
        : safeStr(row?.shipping_mode || "") === "delivery"
          ? "Envío"
          : safeStr(row?.shipping_mode || ""),
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
    const limit = Math.max(1, Math.min(200, safeNum(url.searchParams.get("limit"), 50)));
    const offset = Math.max(0, safeNum(url.searchParams.get("offset"), 0));
    const days = Math.max(1, Math.min(365, safeNum(url.searchParams.get("days"), 90)));

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    let query = sb
      .from("orders")
      .select("*")
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .gte("created_at", dateLimit.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    const { data, error } = await query;

    if (error) {
      return json({ ok: false, error: error.message || "No se pudieron cargar pedidos" }, 500);
    }

    let rows = Array.isArray(data) ? data : [];

    if (status) {
      const target = status.toLowerCase();
      rows = rows.filter((r) => String(r?.status || r?.payment_status || "").toLowerCase() === target);
    }

    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r?.id,
          r?.order_number,
          r?.stripe_session_id,
          r?.checkout_session_id,
          r?.session_id,
          r?.customer_name,
          r?.customer_email,
          r?.customer_phone,
          r?.status,
          r?.payment_status,
          r?.tracking_number,
        ]
          .map((x) => safeStr(x).toLowerCase())
          .join("|");

        return hay.includes(q);
      });
    }

    const total = rows.length;
    const pageRows = rows.slice(offset, offset + limit).map(normalizeOrder);

    return json({
      ok: true,
      org_id: orgId,
      total,
      offset,
      limit,
      items: pageRows,
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}