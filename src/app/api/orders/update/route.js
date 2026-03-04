// src/app/api/orders/update/route.js
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

  // Try org_id first (new schema)
  const q1 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${user?.id || "00000000-0000-0000-0000-000000000000"},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q1?.error && q1?.data?.is_active) return String(q1.data.role || "").toLowerCase();

  // Fallback organization_id (older schema)
  const q2 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${user?.id || "00000000-0000-0000-0000-000000000000"},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q2?.data?.is_active) return null;
  return String(q2.data.role || "").toLowerCase();
}

const allowedStatuses = new Set(["pending", "pending_payment", "paid", "payment_failed", "fulfilled", "cancelled", "refunded"]);

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    const orderId = String(body?.order_id || "").trim();
    const patch = body?.patch || {};

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });
    if (!isUuid(orderId)) return json(400, { ok: false, error: "order_id inválido" });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !hasPerm(role, "orders")) return json(403, { ok: false, error: "Permisos insuficientes" });

    const nextStatus = patch?.status ? String(patch.status).toLowerCase().trim() : null;
    if (nextStatus && !allowedStatuses.has(nextStatus)) return json(400, { ok: false, error: "status inválido" });

    const { data: beforeRow, error: beforeErr } = await sb
      .from("orders")
      .select("id,status,metadata,updated_at,org_id,organization_id")
      .eq("id", orderId)
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
      .maybeSingle();

    if (beforeErr) return json(500, { ok: false, error: "No se pudo leer el pedido" });
    if (!beforeRow?.id) return json(404, { ok: false, error: "Pedido no encontrado" });

    const update = { updated_at: new Date().toISOString() };
    if (nextStatus) update.status = nextStatus;

    const { error: upErr } = await sb
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`);

    if (upErr) return json(500, { ok: false, error: "No se pudo actualizar el pedido" });

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "orders.update",
      entity: "orders",
      entity_id: orderId,
      summary: `Order updated (${nextStatus || "no status change"})`,
      before: beforeRow,
      after: { ...beforeRow, ...update },
      meta: { patch: { status: nextStatus } },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}