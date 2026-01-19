import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { canManageUsers, normalizeRole } from "@/lib/authz";

function json(status, body) {
  return NextResponse.json(body, { status });
}

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    // 1) user real
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: authErr });

    // 2) body
    const body = await req.json();
    const { org_id, email, role } = body || {};

    if (!org_id || !email || !role) {
      return json(400, { error: "Missing org_id/email/role" });
    }

    const cleanRole = normalizeRole(role);
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail.includes("@")) return json(400, { error: "Invalid email" });

    // 3) requester membership role
    const { data: requesterMem, error: memErr } = await sb
      .from("org_memberships")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr) return json(500, { error: memErr.message });

    const requesterRole = (requesterMem?.role || "viewer").toLowerCase();
    if (!canManageUsers(requesterRole)) return json(403, { error: "Not allowed" });

    // 4) invite real
    const redirectTo = process.env.NEXT_PUBLIC_INVITE_REDIRECT || undefined;

    const { data: invited, error: invErr } = await sb.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo
    });

    if (invErr) return json(500, { error: invErr.message });

    const newUserId = invited?.user?.id;
    if (!newUserId) return json(500, { error: "Invite created but user id missing" });

    // 5) upsert membership
    const { error: upErr } = await sb
      .from("org_memberships")
      .upsert({ org_id, user_id: newUserId, role: cleanRole }, { onConflict: "org_id,user_id" });

    if (upErr) return json(500, { error: upErr.message });

    return json(200, { ok: true, user_id: newUserId, role: cleanRole });
  } catch (e) {
    return json(500, { error: e?.message || "Server error" });
  }
}