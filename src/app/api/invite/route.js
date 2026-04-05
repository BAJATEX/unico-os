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
  return safeStr(
    body?.org_id || body?.organization_id || body?.orgId || ""
  ).trim();
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);

  if (!token) {
    return { ok: false, res: json(401, { ok: false, error: "Missing token" }) };
  }

  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const myRole = await getMyRoleForOrg(sb, orgId, user);

  if (!myRole || !canManageUsers(myRole)) {
    return {
      ok: false,
      res: json(403, { ok: false, error: "Permisos insuficientes" }),
    };
  }

  return { ok: true, user, myRole };
}

export async function POST(req) {
  try {
    const sb = serverSupabase();

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

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const now = new Date().toISOString();

    const { data, error } = await sb
      .from("admin_users")
      .upsert(
        {
          org_id: orgId,
          organization_id: orgId,
          email,
          role,
          is_active: true,
          updated_at: now,
        },
        { onConflict: "org_id,email" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    await writeAudit(sb, {
      organization_id: orgId,
      org_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "admin_users.invite",
      entity: "admin_users",
      entity_id: email,
      summary: `Invite updated/created for ${email}`,
      after: data,
    });

    return json(200, {
      ok: true,
      email,
      role,
      org_id: orgId,
    });
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