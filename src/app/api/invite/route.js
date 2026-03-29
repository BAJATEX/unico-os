// src/app/api/invite/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { canManageUsers } from "@/lib/authz";
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

  const try1 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.eq.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!try1?.error && try1?.data?.is_active) return String(try1.data.role || "").toLowerCase();

  const try2 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.eq.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!try2?.data?.is_active) return null;
  return String(try2.data.role || "").toLowerCase();
}

async function findExistingInvite(sb, orgId, email) {
  const q = sb
    .from("admin_users")
    .select("id,org_id,organization_id,email,role,is_active,created_at,updated_at,user_id")
    .eq("email", email)
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .limit(1)
    .maybeSingle();

  const { data, error } = await q;
  if (error) return null;
  return data || null;
}

async function upsertInvite(sb, row) {
  const existing = await findExistingInvite(sb, row.org_id || row.organization_id, row.email);

  if (existing?.id) {
    const updatePayload = {
      org_id: row.org_id || row.organization_id || existing.org_id || existing.organization_id || null,
      organization_id: row.organization_id || row.org_id || existing.organization_id || existing.org_id || null,
      email: row.email,
      role: row.role,
      is_active: true,
      updated_at: row.updated_at,
    };

    const { error } = await sb.from("admin_users").update(updatePayload).eq("id", existing.id);
    if (error) throw error;

    return { mode: "update", id: existing.id };
  }

  const insertPayload = {
    org_id: row.org_id || row.organization_id,
    organization_id: row.organization_id || row.org_id,
    email: row.email,
    role: row.role,
    is_active: true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  const { data, error } = await sb.from("admin_users").insert(insertPayload).select("id").maybeSingle();
  if (error) throw error;

  return { mode: "insert", id: data?.id || null };
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || body?.organization_id || "").trim();
    const email = normEmail(body?.email);
    const role = String(body?.role || "viewer").trim().toLowerCase();

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });
    if (!email || !email.includes("@")) return json(400, { ok: false, error: "Email inválido" });

    const myRole = await getMyRole(sb, orgId, user);
    if (!myRole || !canManageUsers(myRole)) return json(403, { ok: false, error: "Permisos insuficientes" });

    const now = new Date().toISOString();

    const result = await upsertInvite(sb, {
      org_id: orgId,
      organization_id: orgId,
      email,
      role,
      is_active: true,
      updated_at: now,
      created_at: now,
    });

    await writeAudit(sb, {
      organization_id: orgId,
      org_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "admin_users.invite",
      entity: "admin_users",
      entity_id: email,
      summary: `${result.mode === "update" ? "Updated" : "Created"} invite for ${email} as ${role}`,
      meta: { role, mode: result.mode },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, mode: result.mode, email, role });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}