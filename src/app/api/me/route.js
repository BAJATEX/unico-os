// src/app/api/me/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

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

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(arr) ? arr : []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeOrgRow(row) {
  if (!row || typeof row !== "object") return null;

  const id = safeStr(row.id || row.organization_id || row.org_id || "").trim();
  if (!id) return null;

  return {
    organization_id: id,
    organization_name: safeStr(row.name || row.organization_name || "").trim() || "Organización",
    organization_slug: safeStr(row.slug || row.organization_slug || "").trim() || "",
    role: safeStr(row.role || "viewer").trim().toLowerCase(),
    is_active: row.is_active !== false,
  };
}

function normalizeMembershipRow(row) {
  if (!row || typeof row !== "object") return null;

  const orgRel =
    row.organizations && typeof row.organizations === "object"
      ? row.organizations
      : null;

  const orgId = safeStr(
    row.organization_id ||
      row.org_id ||
      orgRel?.id ||
      ""
  ).trim();

  if (!orgId) return null;

  return {
    organization_id: orgId,
    organization_name:
      safeStr(
        orgRel?.name ||
          row.organization_name ||
          row.name ||
          ""
      ).trim() || "Organización",
    organization_slug: safeStr(
      orgRel?.slug ||
        row.organization_slug ||
        row.slug ||
        ""
    ).trim(),
    role: safeStr(row.role || "viewer").trim().toLowerCase(),
    is_active: row.is_active !== false,
  };
}

async function fetchMembershipRows(sb, user) {
  const email = normEmail(user?.email);
  const uid = safeStr(user?.id || "").trim();

  const queries = [
    sb
      .from("admin_users")
      .select(
        "id, role, is_active, user_id, email, org_id, organization_id, organizations:organization_id(id, name, slug)"
      )
      .eq("is_active", true)
      .or(`user_id.eq.${uid},email.ilike.${email}`),

    sb
      .from("admin_users")
      .select(
        "id, role, is_active, user_id, email, org_id, organization_id, organizations:org_id(id, name, slug)"
      )
      .eq("is_active", true)
      .or(`user_id.eq.${uid},email.ilike.${email}`),
  ];

  const rows = [];
  for (const q of queries) {
    const { data, error } = await q.limit(100);
    if (error) continue;
    if (Array.isArray(data)) rows.push(...data);
  }

  return rows;
}

function organizationFromMembership(row) {
  const normalized = normalizeMembershipRow(row);
  if (!normalized) return null;

  return normalizeOrgRow({
    id: normalized.organization_id,
    name: normalized.organization_name,
    slug: normalized.organization_slug,
    role: normalized.role,
    is_active: normalized.is_active,
  });
}

async function resolveDefaultOrg(sb, user, organizations) {
  const active = (Array.isArray(organizations) ? organizations : []).filter(
    (o) => o && o.organization_id && o.is_active !== false
  );

  if (active.length === 1) return safeStr(active[0].organization_id);

  const preferredSlug = "score-store";
  const bySlug = active.find((o) => safeStr(o.organization_slug).toLowerCase() === preferredSlug);
  if (bySlug) return safeStr(bySlug.organization_id);

  const byName = active.find((o) =>
    /score/i.test(safeStr(o.organization_name))
  );
  if (byName) return safeStr(byName.organization_id);

  try {
    const { data: orgBySlug } = await sb
      .from("organizations")
      .select("id, name, slug, created_at")
      .eq("slug", preferredSlug)
      .limit(1)
      .maybeSingle();

    if (orgBySlug?.id) return safeStr(orgBySlug.id);
  } catch {}

  try {
    const { data: orgByName } = await sb
      .from("organizations")
      .select("id, name, slug, created_at")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (orgByName?.id) return safeStr(orgByName.id);
  } catch {}

  const { data: firstOrg } = await sb
    .from("organizations")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
    .catch(() => ({ data: null }));

  if (firstOrg?.id) return safeStr(firstOrg.id);

  return safeStr(organizations?.[0]?.organization_id || "");
}

async function buildMeResponse(sb, user) {
  const rows = await fetchMembershipRows(sb, user);
  const organizations = uniqBy(
    rows
      .map(organizationFromMembership)
      .filter(Boolean),
    (x) => x.organization_id
  );

  const organization_id = await resolveDefaultOrg(sb, user, organizations);
  const current =
    organizations.find((x) => x.organization_id === organization_id) ||
    organizations[0] ||
    null;

  const role = safeStr(current?.role || "viewer").toLowerCase();
  const organization_name = safeStr(current?.organization_name || "Organización");

  return {
    ok: true,
    user: {
      id: user?.id || null,
      email: user?.email || null,
      email_confirmed_at: user?.email_confirmed_at || null,
      role,
    },
    role,
    organization_id,
    organization_name,
    organizations,
    current_organization: current,
    default_organization_id: organization_id,
  };
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error } = await requireUserFromToken(sb, token);
    if (error || !user) {
      return json(401, { ok: false, error: error || "No autorizado" });
    }

    const payload = await buildMeResponse(sb, user);
    return json(200, payload);
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function OPTIONS() {
  return json(204, {});
}