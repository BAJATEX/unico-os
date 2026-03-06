export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const normEmail = (s) => String(s || "").trim().toLowerCase();

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error } = await requireUserFromToken(sb, token);
    if (error || !user) {
      return json({ ok: false, error: "No autorizado" }, 401);
    }

    const email = normEmail(user.email);
    let organization_id = null;
    let role = null;

    const q1 = await sb
      .from("admin_users")
      .select("organization_id, org_id, role, is_active")
      .eq("is_active", true)
      .or(`user_id.eq.${user.id},email.ilike.${email}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!q1.error && q1.data) {
      organization_id = q1.data.organization_id || q1.data.org_id || null;
      role = q1.data.role || null;
    }

    return json({
      ok: true,
      id: user.id,
      email: user.email || "",
      organization_id,
      role,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}