// src/app/api/orders/update/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { writeAudit } from "@/lib/auditServer";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

const normEmail = (s) => String(s || "").trim().toLowerCase();

const ALLOWED_STATUS = new Set([
  "paid",
  "pending_payment",
  "pending",
  "payment_failed",
  "fulfilled",
  "cancelled",
  "refunded",
]);

function pickPatch(patch) {
  const out = {};
  if (!patch || typeof patch !== "object") return out;

  if (typeof patch.status === "string") {
    const st = patch.status.trim().toLowerCase();
    if (ALLOWED_STATUS.has(st)) out.status = st;
  }
  return out;
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    const orderId = String(body?.order_id || "").trim();
    const patch = pickPatch(body?.patch);

    if (!isUuid(orgId) || !orderId) return json(400, { ok: false, error: "org_id y order_id requeridos." });
    if (!Object.keys(patch).length) return json(400, { ok: false, error: "Patch inválido o vacío." });

    // Membership check (solo ops/admin/owner)
    const email = normEmail(user?.email);
    const { data: mem, error: memErr } = await sb
      .from("admin_users")
      .select("role,is_active")
      .eq("organization_id", orgId)
      .ilike("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (memErr) return json(500, { ok: false, error: memErr.message });
    const role = String(mem?.role || "").toLowerCase();
    if (!mem || !["owner", "admin", "ops"].includes(role)) {
      return json(403, { ok: false, error: "Permisos insuficientes." });
    }

    // read-before (for audit)
    const { data: before } = await sb
      .from("orders")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("id", orderId)
      .maybeSingle();

    const { data: updated, error: upErr } = await sb
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", orderId)
      .select("*")
      .maybeSingle();

    if (upErr) return json(400, { ok: false, error: upErr.message });
    if (!updated) return json(404, { ok: false, error: "Pedido no encontrado." });

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: email,
      actor_user_id: user?.id || null,
      action: "orders.update",
      entity: "orders",
      entity_id: String(orderId),
      summary: `Order status: ${before?.status || "?"} → ${updated?.status || "?"}`,
      before: before ? { status: before.status } : null,
      after: { status: updated.status },
      meta: { role },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, order: updated });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}