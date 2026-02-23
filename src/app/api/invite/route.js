import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { canManageUsers } from "@/lib/authz";

function json(status, body) { return NextResponse.json(body, { status }); }

function getBearerToken(req) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: authErr });

    const { organization_id, email, role } = await req.json();
    if (!organization_id || !email || !role) return json(400, { error: "Datos incompletos" });

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Validar si el usuario actual es Owner/Admin (Usando admin_users de Score Store)
    const { data: reqUser, error: memErr } = await sb
      .from("admin_users")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("email", user.email)
      .is("is_active", true)
      .maybeSingle();

    if (memErr) return json(500, { error: memErr.message });
    const reqRole = (reqUser?.role || "viewer").toLowerCase();
    if (!canManageUsers(reqRole)) return json(403, { error: "Privilegios insuficientes" });

    // 2. Invitar vía Supabase Auth
    const { error: invErr } = await sb.auth.admin.inviteUserByEmail(cleanEmail);
    if (invErr && !invErr.message.includes("already registered")) {
      return json(500, { error: invErr.message });
    }

    // 3. Upsert en admin_users
    const { error: upErr } = await sb
      .from("admin_users")
      .upsert(
        { organization_id, email: cleanEmail, role: role.toLowerCase(), is_active: true },
        { onConflict: "email" } 
      );

    if (upErr) return json(500, { error: upErr.message });
    return json(200, { ok: true, email: cleanEmail, role });
  } catch (e) { return json(500, { error: e?.message || "Server error" }); }
}