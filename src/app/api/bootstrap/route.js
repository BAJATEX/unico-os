export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { writeAudit } from "@/lib/auditServer";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const normEmail = (s) => String(s || "").trim().toLowerCase();

const SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";
const UNICO_ORG_ID = "8a8c2f32-0d8f-4b33-9cbe-5a4e2e0d9d3b";

async function countAdminUsers(sb) {
  const { count } = await sb.from("admin_users").select("id", { count: "exact", head: true });
  return Number(count || 0);
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const email = normEmail(user?.email);
    if (!email) return json(400, { ok: false, error: "Email inválido" });

    const { data: existing } = await sb
      .from("admin_users")
      .select("id, organization_id, role, is_active")
      .eq("is_active", true)
      .or(`user_id.eq.${user?.id},email.ilike.${email}`)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return json(200, { ok: true, already: true, organizations: [existing.organization_id] });

    const adminCount = await countAdminUsers(sb);
    const secret = process.env.UNICOS_BOOTSTRAP_SECRET;
    const provided = String(req.headers.get("x-unicos-bootstrap") || "").trim();

    if (adminCount > 0) {
      if (!secret || !provided || provided !== secret) {
        return json(403, { ok: false, error: "Acceso restringido. Pide invitación o ejecuta bootstrap con secret." });
      }
    }

    await sb.from("organizations").upsert(
      [
        { id: SCORE_ORG_ID, name: "Score Store", slug: "score-store" },
        { id: UNICO_ORG_ID, name: "Único Uniformes", slug: "unico-uniformes" },
      ],
      { onConflict: "id" }
    );

    await sb.from("admin_users").upsert(
      [
        { organization_id: SCORE_ORG_ID, user_id: user?.id, email, role: "owner", is_active: true, last_login: new Date().toISOString() },
        { organization_id: UNICO_ORG_ID, user_id: user?.id, email, role: "owner", is_active: true, last_login: new Date().toISOString() },
      ],
      { onConflict: "organization_id,email" }
    );

    await writeAudit(sb, {
      organization_id: SCORE_ORG_ID,
      actor_email: email,
      actor_user_id: user?.id || null,
      action: "bootstrap.owner_grant",
      entity: "admin_users",
      entity_id: email,
      summary: "Bootstrap: granted owner access",
      meta: { organizations: [SCORE_ORG_ID, UNICO_ORG_ID] },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, organizations: [SCORE_ORG_ID, UNICO_ORG_ID] });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}