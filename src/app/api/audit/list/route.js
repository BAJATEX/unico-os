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

function normalizeLower(v) {
  return safeStr(v).trim().toLowerCase();
}

function normalizeText(v) {
  return safeStr(v).trim();
}

function parseOrgId(req, url) {
  const fromQuery = normalizeText(url.searchParams.get("org_id") || url.searchParams.get("orgId") || url.searchParams.get("organization_id") || "");
  return fromQuery;
}

function parseLimit(url) {
  const raw = url.searchParams.get("limit") || "50";
  return clampInt(raw, 1, 250, 50);
}

function parseSearch(url) {
  return normalizeText(url.searchParams.get("search") || url.searchParams.get("q") || "");
}

function parseEntity(url) {
  return normalizeText(url.searchParams.get("entity") || "");
}

function parseAction(url) {
  return normalizeText(url.searchParams.get("action") || "");
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

function buildQueryFilters(query, search, entity, action) {
  let q = query;

  if (entity) {
    q = q.eq("entity", entity);
  }

  if (action) {
    q = q.eq("action", action);
  }

  if (search) {
    const s = normalizeLower(search);
    q = q.or(
      [
        `summary.ilike.%${s}%`,
        `action.ilike.%${s}%`,
        `entity.ilike.%${s}%`,
        `actor_email.ilike.%${s}%`,
        `entity_id.ilike.%${s}%`,
      ].join(",")
    );
  }

  return q;
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
  let query = sb
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

  query = applyOrgFilter(query, orgId);
  query = buildQueryFilters(query, search, entity, action);

  const { data, error } = await query;
  return {
    data: Array.isArray(data) ? data : [],
    error,
  };
}

async function maybeAuditRead(sb, orgId, auth, rows, params) {
  try {
    await writeAudit(sb, {
      organization_id: orgId,
      org_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "audit.read",
      entity: "audit_log",
      entity_id: String(rows?.length || 0),
      summary: `Read audit rows${params.search ? ` · search=${params.search}` : ""}`,
      before: null,
      after: {
        rows: Array.isArray(rows) ? rows.length : 0,
      },
      meta: {
        role: auth.role,
        limit: params.limit,
        entity: params.entity || null,
        action_filter: params.action || null,
        search: params.search || null,
        source: "api/audit/list",
      },
      ip: params.ip || null,
      user_agent: params.user_agent || null,
    });
  } catch {
    // no-op: lectura debe seguir aunque el log falle
  }
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);

    const orgId = parseOrgId(req, url);
    const limit = parseLimit(url);
    const search = parseSearch(url);
    const entity = parseEntity(url);
    const action = parseAction(url);

    if (!isUuid(orgId)) {
      return json(400, { ok: false, error: "org_id inválido" });
    }

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const result = await readAuditRows(sb, orgId, limit, entity, action, search);
    if (result.error) {
      return json(500, { ok: false, error: result.error.message || "No se pudo leer auditoría." });
    }

    const rows = (result.data || []).map(normalizeRow).filter(Boolean);

    await maybeAuditRead(
      sb,
      orgId,
      auth,
      rows,
      {
        limit,
        entity,
        action,
        search,
        ip: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      }
    );

    return json(200, {
      ok: true,
      org_id: orgId,
      role: auth.role,
      count: rows.length,
      limit,
      entity: entity || "",
      action: action || "",
      search: search || "",
      rows,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function POST(req) {
  return GET(req);
}

export async function PATCH(req) {
  return GET(req);
}

export async function OPTIONS() {
  return json(204, {});
}