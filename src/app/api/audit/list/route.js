// src/app/api/audit/list/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg, applyOrgFilter } from "@/lib/dbScope";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const { searchParams } = new URL(req.url);
    const orgId = String(searchParams.get("org_id") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || 80);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
      : 80;

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !["owner", "admin"].includes(role)) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    const q = sb
      .from("audit_log")
      .select("id, created_at, actor_email, action, entity, entity_id, summary, meta, org_id, organization_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    const { data: rows, error } = await applyOrgFilter(q, orgId);

    if (error) return json(200, { ok: true, rows: [] });

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "audit.list",
      entity: "audit_log",
      entity_id: String(limit),
      summary: "Listed audit log",
      meta: { limit },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, rows: rows || [] });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}