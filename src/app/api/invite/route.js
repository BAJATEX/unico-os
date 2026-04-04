// src/app/api/invite/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { canManageUsers, normalizeRole } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg } from "@/lib/dbScope";

const ALLOWED_ROLES = new Set([
  "owner",
  "admin",
  "marketing",
  "ops",
  "support",
  "finance",
  "viewer",
]);

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (status, payload) =>
  NextResponse.json(payload, { status, headers: noStoreHeaders });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function cleanEmail(email) {
  return normEmail(email).trim().toLowerCase();
}

function cleanRole(role) {
  const r = normalizeRole(role).trim().toLowerCase();
  return ALLOWED_ROLES.has(r) ? r : "viewer";
}

function resolveOrgId(body = {}) {
  return safeStr(body?.org_id || body?.organization_id || body?.orgId || "").trim();
}

async function getInviteRow(sb, orgId, email) {
  const q1 = await sb
    .from("admin_users")
    .select("id, org_id, organization_id, email, role, is_active, user_id, created_at, updated_at")
    .eq("org_id", orgId)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (!q1?.error && q1?.data?.id) return q1.data;

  const q2 = await sb
    .from("admin_users")
    .select("id, org_id, organization_id, email, role, is_active, user_id, created_at, updated_at")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (!q2?.error && q2?.data?.id) return q2.data;

  return null;
}

async function upsertInvite(sb, row) {
  const orgId = safeStr(row?.org_id || row?.organization_id || "").trim();
  const email = cleanEmail(row?.email);
  const role = cleanRole(row?.role);
  const now = new Date().toISOString();

  const existing = await getInviteRow(sb, orgId, email);

  if (existing?.id) {
    const updatePayload = {
      org_id: orgId,
      organization_id: orgId,
      email,
      role,
      is_active: true,
      updated_at: now,
    };

    const { error } = await sb
      .from("admin_users")
      .update(updatePayload)
      .eq("id", existing.id);

    if (error) throw error;

    return {
      mode: "update",
      id: existing.id,
      email,
      role,
    };
  }

  const insertPayload = {
    org_id: orgId,
    organization_id: orgId,
    email,
    role,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await sb
    .from("admin_users")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  return {
    mode: "insert",
    id: data?.id || null,
    email,
    role,
  };
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const myRole = await getMyRoleForOrg(sb, orgId, user);
  if (!myRole || !canManageUsers(myRole)) {
    return { ok: false, res: json(403, { ok: false, error: "Permisos insuficientes" }) };
  }

  return { ok: true, user, myRole };
}

async function handleInvite(req) {
  const sb = serverSupabase();
  if (!sb) {
    return json(500, { ok: false, error: "Supabase no configurado" });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = resolveOrgId(body);
  const email = cleanEmail(body?.email);
  const role = cleanRole(body?.role || "viewer");

  if (!isUuid(orgId)) {
    return json(400, { ok: false, error: "org_id inválido" });
  }

  if (!email || !email.includes("@")) {
    return json(400, { ok: false, error: "Email inválido" });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json(400, { ok: false, error: "Rol inválido" });
  }

  const auth = await authorize(req, sb, orgId);
  if (!auth.ok) return auth.res;

  const result = await upsertInvite(sb, {
    org_id: orgId,
    organization_id: orgId,
    email,
    role,
    is_active: true,
  });

  await writeAudit(sb, {
    organization_id: orgId,
    org_id: orgId,
    actor_email: normEmail(auth.user?.email),
    actor_user_id: auth.user?.id || null,
    action: "admin_users.invite",
    entity: "admin_users",
    entity_id: email,
    summary: `${result.mode === "update" ? "Updated" : "Created"} invite for ${email} as ${role}`,
    after: {
      mode: result.mode,
      email,
      role,
      is_active: true,
    },
    meta: {
      mode: result.mode,
      role,
      source: "api/invite",
      actor_role: auth.myRole,
    },
    ip: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  return json(200, {
    ok: true,
    mode: result.mode,
    email,
    role,
    org_id: orgId,
  });
}

export async function POST(req) {
  try {
    return await handleInvite(req);
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function PATCH(req) {
  return POST(req);
}

export async function GET() {
  return json(405, { ok: false, error: "Method not allowed" });
}

export async function OPTIONS() {
  return json(204, {});
}