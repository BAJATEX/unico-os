// src/app/api/envia/summary/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || "").trim());

const normEmail = (s) => String(s || "").trim().toLowerCase();
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function getMyRole(sb, orgId, user) {
  const myEmail = normEmail(user?.email);
  const uid = user?.id || "00000000-0000-0000-0000-000000000000";

  const q1 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q1?.error && q1?.data?.is_active) return String(q1.data.role || "").toLowerCase();

  const q2 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q2?.error && q2?.data?.is_active) return String(q2.data.role || "").toLowerCase();

  return null;
}

function pickTracking(raw) {
  // Intentamos extraer tracking real de varias formas (sin inventar)
  // dependiendo del carrier/estructura que devuelve envía.
  const r = raw || {};
  const candidates = [
    r?.trackingNumber,
    r?.tracking_number,
    r?.data?.trackingNumber,
    r?.data?.tracking_number,
    r?.shipment?.trackingNumber,
    r?.shipment?.tracking_number,
    r?.label?.trackingNumber,
    r?.label?.tracking_number,
    r?.waybill,
    r?.waybillNumber,
    r?.guide,
    r?.guideNumber,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter(Boolean);

  return candidates[0] || "";
}

function pickCarrier(raw) {
  const r = raw || {};
  const candidates = [
    r?.carrier,
    r?.carrierName,
    r?.carrier_name,
    r?.data?.carrier,
    r?.data?.carrierName,
    r?.shipment?.carrier,
    r?.shipment?.carrierName,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter(Boolean);

  return candidates[0] || "";
}

function pickTotalAmount(raw) {
  const r = raw || {};
  return (
    num(r?.totalAmount) ||
    num(r?.total_amount) ||
    num(r?.data?.totalAmount) ||
    num(r?.data?.total_amount) ||
    num(r?.shipment?.totalAmount) ||
    num(r?.shipment?.total_amount) ||
    0
  );
}

async function enviaTrack(trackingNumbers = []) {
  const token = process.env.ENVIA_API_KEY;
  if (!token) return { ok: false, error: "Falta ENVIA_API_KEY" };

  const list = Array.from(new Set(trackingNumbers.map((x) => String(x || "").trim()).filter(Boolean))).slice(0, 25);
  if (!list.length) return { ok: true, rows: [] };

  const res = await fetch("https://api.envia.com/ship/generaltrack/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trackingNumbers: list }),
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: j?.message || j?.error || `Envía track error (${res.status})` };

  // La estructura puede variar, regresamos lo que venga sin inventar
  return { ok: true, raw: j };
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    const includeTrack = body?.include_track === true;

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !["owner", "admin", "ops", "finance"].includes(role)) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    const { data: labels, error } = await sb
      .from("shipping_labels")
      .select("id, stripe_session_id, raw, created_at, org_id, organization_id")
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return json(200, { ok: true, rows: [], totals: { labels: 0, cost_mxn: 0 }, updated_at: new Date().toISOString() });

    const rows = (labels || []).map((r) => {
      const raw = r?.raw || {};
      const tracking = pickTracking(raw);
      const carrier = pickCarrier(raw);
      const totalAmount = pickTotalAmount(raw);

      return {
        id: r.id,
        created_at: r.created_at,
        stripe_session_id: r.stripe_session_id || null,
        carrier,
        tracking,
        cost_mxn: totalAmount,
        raw,
      };
    });

    const totalCost = rows.reduce((a, x) => a + num(x.cost_mxn), 0);

    let trackingResult = null;
    if (includeTrack) {
      const trackingNums = rows.map((x) => x.tracking).filter(Boolean);
      trackingResult = await enviaTrack(trackingNums);
    }

    return json(200, {
      ok: true,
      totals: {
        labels: rows.length,
        cost_mxn: totalCost,
      },
      rows: rows.slice(0, 30), // UI friendly
      tracking: trackingResult, // raw de Envía (si se pidió)
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}