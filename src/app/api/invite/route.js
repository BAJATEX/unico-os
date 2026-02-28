// src/app/api/invite/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

const normEmail = (s) => String(s || "").trim().toLowerCase();

const ALLOWED_ROLES = new Set(["owner", "admin", "ops", "sales", "marketing", "staff", "viewer"]);

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.organization_id || "").trim();
    const email = normEmail(body?.email);
    const role = String(body?.role || "viewer").trim().toLowerCase();

    if (!isUuid(orgId)) return json(400, { ok: false, error: "organization_id inválido." });
    if (!email || !email.includes("@")) return json(400, { ok: false, error: "Email inválido." });
    if (!ALLOWED_ROLES.has(role)) return json(400, { ok: false, error: "Rol inválido." });

    // Only owner/admin can invite
    const myEmail = normEmail(user?.email);
    const { data: mem } = await sb
      .from("admin_users")
      .select("role,is_active")
      .eq("organization_id", orgId)
      .ilike("email", myEmail)
      .eq("is_active", true)
      .maybeSingle();

    const myRole = String(mem?.role || "").toLowerCase();
    if (!mem || !["owner", "admin"].includes(myRole)) {
      return json(403, { ok: false, error: "Permisos insuficientes." });
    }

    // Upsert admin_users (no secrets)
    const payload = {
      organization_id: orgId,
      email,
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from("admin_users")
      .upsert(payload, { onConflict: "organization_id,email" });

    if (error) return json(400, { ok: false, error: error.message });

    return json(200, { ok: true, invited: { email, role } });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}