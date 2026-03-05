import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { requireUserFromToken } from "@/lib/authServer";
import { hasPerm } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const requireBearer = (req) => {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
};

// lectura real desde raw (tu operación)
const pickTotalFromRaw = (raw) =>
  num(raw?.totalAmount) ||
  num(raw?.data?.totalAmount) ||
  num(raw?.shipment?.totalAmount) ||
  num(raw?.data?.shipment?.totalAmount) ||
  0;

const pickTrackingFromRaw = (raw) =>
  raw?.trackingNumber ||
  raw?.tracking_number ||
  raw?.data?.trackingNumber ||
  raw?.data?.tracking_number ||
  raw?.shipment?.trackingNumber ||
  raw?.shipment?.tracking_number ||
  null;

const pickCarrierFromRaw = (raw) =>
  raw?.carrier ||
  raw?.carrier_name ||
  raw?.data?.carrier ||
  raw?.data?.carrier_name ||
  raw?.shipment?.carrier ||
  raw?.shipment?.carrier_name ||
  null;

export async function GET(req) {
  try {
    const token = requireBearer(req);
    const user = await requireUserFromToken(token);

    const { searchParams } = new URL(req.url);
    const orgId = String(searchParams.get("org_id") || "").trim();
    const days = Math.min(365, Math.max(7, Number(searchParams.get("days") || "30")));

    if (!orgId) return json({ ok: false, error: "Falta org_id" }, 400);

    const sb = serverSupabase();
    const { data: adminRow } = await sb
      .from("admin_users")
      .select("id, role, is_active, organization_id, user_id, email")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .or(`user_id.eq.${user.id},email.ilike.${user.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (!adminRow) return json({ ok: false, error: "No autorizado" }, 403);
    if (!hasPerm(adminRow.role, "view_finance")) return json({ ok: false, error: "Sin permisos" }, 403);

    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    // soporta org_id o organization_id (porque en tu ecosistema ya viste ambos)
    const { data: labels, error } = await sb
      .from("shipping_labels")
      .select("id, org_id, organization_id, stripe_session_id, raw, created_at")
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(600);

    if (error) throw new Error(error.message);

    const list = (labels || []).map((r) => {
      const raw = r?.raw || {};
      const total = pickTotalFromRaw(raw);
      return {
        id: r.id,
        stripe_session_id: r.stripe_session_id || null,
        created_at: r.created_at,
        total_amount_mxn: total,
        tracking: pickTrackingFromRaw(raw) ? String(pickTrackingFromRaw(raw)) : null,
        carrier: pickCarrierFromRaw(raw) ? String(pickCarrierFromRaw(raw)) : null,
      };
    });

    const totalMXN = list.reduce((a, x) => a + num(x.total_amount_mxn), 0);

    return json({
      ok: true,
      scope: { org_id: orgId, days, labels_count: list.length },
      kpi: { envia_cost_mxn: Math.round(totalMXN * 100) / 100 },
      labels: list.slice(0, 80),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}