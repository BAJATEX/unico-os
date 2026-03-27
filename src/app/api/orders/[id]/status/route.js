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

const normalizeOrder = (row) => ({
  id: safeStr(row?.id),
  status: safeStr(row?.status || "pending"),
  payment_status: safeStr(row?.payment_status || ""),
  customer_name: safeStr(row?.customer_name || row?.name),
  customer_email: safeStr(row?.customer_email || row?.email),
  customer_phone: safeStr(row?.customer_phone || row?.phone),
  shipping_mode: safeStr(row?.shipping_mode || ""),
  tracking_number: safeStr(row?.tracking_number || row?.tracking || ""),
  shipping_label_url: safeStr(row?.shipping_label_url || ""),
  updated_at: row?.updated_at || null,
  raw: row,
});

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

    if ("status" in body) patch.status = safeStr(body.status);
    if ("payment_status" in body) patch.payment_status = safeStr(body.payment_status);
    if ("tracking_number" in body) patch.tracking_number = safeStr(body.tracking_number);
    if ("shipping_label_url" in body) patch.shipping_label_url = safeStr(body.shipping_label_url);
    if ("notes" in body) patch.notes = safeStr(body.notes);
    if ("shipping_mode" in body) patch.shipping_mode = safeStr(body.shipping_mode);

    if (!Object.keys(patch).length) {
      return json({ ok: false, error: "No fields to update" }, 400);
    }

    const now = new Date().toISOString();

    let result = await sb
      .from("orders")
      .update({ ...patch, updated_at: now })
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .eq("id", id)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (result?.error && /deleted_at|column/i.test(result.error.message || "")) {
      result = await sb
        .from("orders")
        .update({ ...patch })
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .eq("id", id)
        .select("*")
        .limit(1)
        .maybeSingle();
    }

    const { data, error } = result;
    if (error) return json({ ok: false, error: error.message || "No se pudo actualizar" }, 500);
    if (!data) return json({ ok: false, error: "Order not found" }, 404);

    return json({ ok: true, order: normalizeOrder(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}