// src/app/api/invite/route.js
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

const normEmail = (s) => String(s || "").trim().toLowerCase();

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

async function getMyRole(sb, orgId, user) {
  const myEmail = normEmail(user?.email);

  const { data: mem } = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(
      `user_id.eq.${user?.id || "00000000-0000-0000-0000-000000000000"},email.ilike.${myEmail}`
    )
    .limit(1)
    .maybeSingle();

  if (!mem?.is_active) return null;
  return String(mem?.role || "").toLowerCase();
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    const email = normEmail(body?.email);
    const role = String(body?.role || "viewer").trim().toLowerCase();

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });
    if (!email) return json(400, { ok: false, error: "email inválido" });

    const myRole = await getMyRole(sb, orgId, user);
    if (!myRole || !hasPerm(myRole, "users")) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from("admin_users")
      .upsert(
        [{ organization_id: orgId, email, role, is_active: true, updated_at: now }],
        { onConflict: "organization_id,email" }
      )
      .select("id, organization_id, email, role, is_active")
      .maybeSingle();

    if (error) return json(400, { ok: false, error: error.message });

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "admin_users.invite",
      entity: "admin_users",
      entity_id: email,
      summary: `Invited ${email} as ${role}`,
      meta: { role },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, user: data });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}