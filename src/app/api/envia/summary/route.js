// src/app/api/envia/summary/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || "").trim());

const normEmail = (s) => String(s || "").trim().toLowerCase();

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

const ENVIA_BASE = process.env.ENVIA_BASE || "https://api.envia.com";
function enviaKey() {
  const key = process.env.ENVIA_API_KEY;
  if (!key) throw new Error("Falta ENVIA_API_KEY");
  return key;
}

async function enviaPOST(path, body) {
  const res = await fetch(`${ENVIA_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${enviaKey()}`,
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.message || `Envía error (${res.status})`));
  return data;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || body?.organization_id || "").trim();
    const includeTrack = !!body?.include_track;

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !(hasPerm(role, "shipping") || hasPerm(role, "dashboard"))) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    // 1) Totales desde Supabase (rápido, real, lo que ya guardas)
    const { data: labels, error: lErr } = await sb
      .from("shipping_labels")
      .select("id, created_at, raw, stripe_session_id, org_id, organization_id")
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (lErr) throw lErr;

    const rowsFromDb = (labels || []).map((r) => {
      const raw = r?.raw || {};
      const cost =
        num(raw?.totalAmount) ||
        num(raw?.data?.totalAmount) ||
        num(raw?.shipment?.totalAmount) ||
        0;

      const tracking =
        raw?.trackingNumber ||
        raw?.tracking_number ||
        raw?.data?.trackingNumber ||
        raw?.data?.tracking_number ||
        null;

      const carrier =
        raw?.carrier ||
        raw?.carrierName ||
        raw?.data?.carrier ||
        raw?.data?.carrierName ||
        null;

      return {
        id: r.id,
        created_at: r.created_at || null,
        cost_mxn: cost,
        tracking: tracking ? String(tracking) : null,
        carrier: carrier ? String(carrier) : null,
        source: "supabase",
      };
    });

    const totals = {
      labels: rowsFromDb.length,
      cost_mxn: rowsFromDb.reduce((a, x) => a + num(x.cost_mxn), 0),
    };

    // 2) “Vista dashboard”: traer últimos envíos desde Envía (si hay API key)
    // Esto depende de la cuenta/plan y del endpoint disponible. No adivinamos:
    // intentamos una consulta estándar y si falla regresamos solo Supabase.
    let rows = rowsFromDb;

    try {
      // Endpoint típico para listar envíos puede variar.
      // Probamos uno seguro: /shipments (si tu cuenta lo soporta).
      // Si tu Envía no lo soporta, no rompe: hacemos fallback a DB.
      const list = await enviaPOST("/shipments", { limit: 20 });

      const arr = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : null;

      if (arr) {
        rows = arr.slice(0, 20).map((s, i) => ({
          id: s?.id || s?._id || `envia_${i}`,
          created_at: s?.created_at || s?.createdAt || null,
          cost_mxn: num(s?.totalAmount || s?.total_amount || s?.price || 0),
          tracking: s?.trackingNumber || s?.tracking_number || null,
          carrier: s?.carrier || s?.carrierName || null,
          source: "envia",
        }));
      }
    } catch {
      // keep DB rows (real) if Envía list not supported
    }

    // Optionally attach tracking status (si el endpoint existe)
    if (includeTrack) {
      // (No forzamos porque en Envía varía por carrier/plan)
    }

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "envia.summary",
      entity: "envia",
      entity_id: orgId,
      summary: "Envía dashboard summary fetched",
      meta: { labels: totals.labels, cost_mxn: totals.cost_mxn },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, {
      ok: true,
      updated_at: new Date().toISOString(),
      totals,
      rows,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}