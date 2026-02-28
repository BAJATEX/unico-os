// src/app/api/audit/list/route.js
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

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const url = new URL(req.url);
    const orgId = String(url.searchParams.get("org_id") || "").trim();
    const limit = Math.min(200, Math.max(20, Number(url.searchParams.get("limit") || 80)));

    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido." });

    const email = normEmail(user?.email);

    // Solo owner/admin
    const { data: mem } = await sb
      .from("admin_users")
      .select("role,is_active")
      .eq("organization_id", orgId)
      .ilike("email", email)
      .eq("is_active", true)
      .maybeSingle();

    const role = String(mem?.role || "").toLowerCase();
    if (!mem || !["owner", "admin"].includes(role)) {
      return json(403, { ok: false, error: "Permisos insuficientes." });
    }

    const { data, error } = await sb
      .from("audit_log")
      .select("id, created_at, actor_email, action, entity, entity_id, summary, meta")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return json(400, { ok: false, error: error.message });

    return json(200, { ok: true, rows: data || [] });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}