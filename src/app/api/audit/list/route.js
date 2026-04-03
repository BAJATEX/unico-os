// src/app/api/audit/list/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { writeAudit } from "@/lib/auditServer";
import { isUuid, normEmail, getMyRoleForOrg, applyOrgFilter } from "@/lib/dbScope";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function json(status, payload) {
  return NextResponse.json(payload, { status, headers: noStoreHeaders });
}

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clampInt(v, min, max, fallback = min) {
  const n = Math.floor(safeNum(v, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeText(v) {
  return safeStr(v).trim();
}

function normalizeLower(v) {
  return safeStr(v).trim().toLowerCase();
}

function buildQueryFilters(q, search, entity, action) {
  let query = q;

  if (entity) {
    query = query.eq("entity", entity);
  }

  if (action) {
    query = query.eq("action", action);
  }

  if (search) {
    const s = normalizeLower(search);
    query = query.or(
      [
        `summary.ilike.%${s}%`,
        `action.ilike.%${s}%`,
        `entity.ilike.%${s}%`,
        `actor_email.ilike.%${s}%`,
        `entity_id.ilike.%${s}%`,
      ].join(",")
    );
  }

  return query;
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;

  return {
    id: safeStr(row.id),
    created_at: row.created_at || null,
    actor_email: safeStr(row.actor_email || ""),
    actor_user_id: row.actor_user_id || null,
    action: safeStr(row.action || ""),
    entity: safeStr(row.entity || ""),
    entity_id: safeStr(row.entity_id || ""),
    summary: safeStr(row.summary || ""),
    before: row.before ?? null,
    after: row.after ?? null,
    meta: row.meta ?? null,
    ip: safeStr(row.ip || ""),
    user_agent: safeStr(row.user_agent || ""),
    org_id: safeStr(row.org_id || row.organization_id || ""),
    organization_id: safeStr(row.organization_id || row.org_id || ""),
  };
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !["owner", "admin"].includes(String(role).toLowerCase())) {
    return { ok: false, res: json(403, { ok: false, error: "Permisos insuficientes" }) };
  }

  return { ok: true, user, role };
}

async function readAuditRows(sb, orgId, limit, entity, action, search) {
  let q = sb
    .from("audit_log")
    .select(
      [
        "id",
        "created_at",
        "actor_email",
        "actor_user_id",
        "action",
        "entity",
        "entity_id",
        "summary",
        "before",
        "after",
        "meta",
        "ip",
        "user_agent",
        "org_id",
        "organization_id",
      ].join(", ")
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyOrgFilter(q, orgId);
  q = buildQueryFilters(q, search, entity, action);

  const { data, error } = await q;
  return {
    data: Array.isArray(data) ? data : [],
    error,
  };
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);

    const orgId = safeStr(url.searchParams.get("org_id") || url.searchParams.get("orgId") || "").trim();
    const limit = clampInt(url.searchParams.get("limit"), 1, 200, 80);
    const entity = normalizeText(url.searchParams.get("entity"));
    const action = normalizeText(url.searchParams.get("action"));
    const search = normalizeText(url.searchParams.get("q") || url.searchParams.get("search"));

    if (!isUuid(orgId)) {
      return json(400, { ok: false, error: "org_id inválido" });
    }

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const { data, error } = await readAuditRows(sb, orgId, limit, entity, action, search);

    if (error) {
      return json(200, { ok: true, rows: [] });
    }

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "audit.list",
      entity: "audit_log",
      entity_id: String(limit),
      summary: "Listed audit log",
      meta: {
        limit,
        entity: entity || null,
        action: action || null,
        search: search || null,
        role: auth.role,
        source: "api/audit/list",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, {
      ok: true,
      org_id: orgId,
      limit,
      rows: (data || []).map(normalizeRow).filter(Boolean),
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function POST(req) {
  return GET(req);
}