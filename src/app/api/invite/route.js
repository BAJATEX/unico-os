import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { canManageUsers } from "@/lib/authz";

function json(status, body) {
  return NextResponse.json(body, { status });
}

function getBearerToken(req) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const normEmail = (s) => String(s || "").trim().toLowerCase();

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const organization_id = String(body.organization_id || "").trim();
    const email = normEmail(body.email);
    const role = String(body.role || "").trim().toLowerCase();

    if (!organization_id || !email || !role) {
      return json(400, { error: "Datos incompletos" });
    }

    const allowedRoles = ["owner", "admin", "ops", "marketing", "staff", "viewer", "sales"];
    if (!allowedRoles.includes(role)) {
      return json(400, { error: "Rol inválido" });
    }

    const requesterEmail = normEmail(user?.email);

    const { data: reqUser, error: memErr } = await sb
      .from("admin_users")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("email", requesterEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (memErr) return json(500, { error: memErr.message });

    const reqRole = String(reqUser?.role || "viewer").toLowerCase();
    if (!canManageUsers(reqRole)) {
      return json(403, { error: "Privilegios insuficientes" });
    }

    const { error: invErr } = await sb.auth.admin.inviteUserByEmail(email);
    if (invErr && !String(invErr.message || "").toLowerCase().includes("already registered")) {
      return json(500, { error: invErr.message });
    }

    const { error: upErr } = await sb
      .from("admin_users")
      .upsert({ organization_id, email, role, is_active: true }, { onConflict: "organization_id,email" });

    if (upErr) return json(500, { error: upErr.message });

    return json(200, { ok: true, email, role, organization_id });
  } catch (e) {
    return json(500, { error: String(e?.message || "Server error") });
  }
}