// src/app/api/orders/bulk-update/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg, applyOrgFilter } from "@/lib/dbScope";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function clampIds(arr, max = 120) {
  const out = [];
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v || "").trim();
    if (!isUuid(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const allowedStatuses = new Set([
  "pending",
  "pending_payment",
  "paid",
  "payment_failed",
  "fulfilled",
  "cancelled",
  "refunded",
]);

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || body?.organization_id || "").trim();
    const ids = clampIds(body?.order_ids, 200);
    const patch = body?.patch || {};

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });
    if (!ids.length) return json(400, { ok: false, error: "order_ids vacío" });

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !hasPerm(role, "orders")) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    const nextStatus = patch?.status ? String(patch.status).toLowerCase().trim() : null;
    if (nextStatus && !allowedStatuses.has(nextStatus)) {
      return json(400, { ok: false, error: "status inválido" });
    }

    const update = { updated_at: new Date().toISOString() };
    if (nextStatus) update.status = nextStatus;

    const q = sb.from("orders").update(update).in("id", ids);
    const { error: upErr } = await applyOrgFilter(q, orgId);

    if (upErr) return json(500, { ok: false, error: "No se pudo actualizar" });

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "orders.bulk_update",
      entity: "orders",
      entity_id: String(ids.length),
      summary: `Bulk update ${ids.length} orders (${nextStatus || "no status change"})`,
      meta: { count: ids.length, patch: { status: nextStatus } },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, updated: ids.length });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}