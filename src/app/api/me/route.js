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
  const orgFromRel = row?.organizations && typeof row.organizations === "object" ? row.organizations : null;
  const orgId = safeStr(
    row?.organization_id ||
      row?.org_id ||
      orgFromRel?.id ||
      ""
  ).trim();

  if (!orgId) return null;

  return normalizeOrgRow({
    id: orgId,
    name: orgFromRel?.name || row?.organization_name || row?.name || "",
    slug: orgFromRel?.slug || row?.organization_slug || row?.slug || "",
    role: row?.role || "viewer",
    is_active: row?.is_active !== false,
  });
}

async function resolveDefaultOrg(sb, user, organizations) {
  const query = new URLSearchParams();

  try {
    const first = Array.isArray(organizations) ? organizations[0] : null;
    if (first?.organization_id && isUuid(first.organization_id)) return first.organization_id;
  } catch {}

  const email = normEmail(user?.email);
  const uid = safeStr(user?.id || "").trim();

  const candidates = uniqBy(
    [
      ...((Array.isArray(organizations) ? organizations : [])),
    ],
    (x) => safeStr(x?.organization_id || "")
  );

  for (const org of candidates) {
    const role = await getMyRoleForOrg(sb, org.organization_id, user);
    if (role) return org.organization_id;
  }

  try {
    const { data: byUser } = await sb
      .from("admin_users")
      .select("organization_id, org_id, role, is_active, user_id, email")
      .eq("is_active", true)
      .or(`user_id.eq.${uid},email.ilike.${email}`)
      .limit(50);

    if (Array.isArray(byUser)) {
      for (const row of byUser) {
        const oid = safeStr(row?.organization_id || row?.org_id || "").trim();
        if (isUuid(oid)) return oid;
      }
    }
  } catch {}

  try {
    const { data: anyOrg } = await sb
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (anyOrg?.id && isUuid(anyOrg.id)) return anyOrg.id;
  } catch {}

  return "";
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr || !user) {
      return json(401, { ok: false, error: "No autorizado" });
    }

    const memberships = await fetchMembershipRows(sb, user);

    const organizations = uniqBy(
      memberships
        .map(organizationFromMembership)
        .filter(Boolean),
      (x) => x.organization_id
    );

    const defaultOrgId = await resolveDefaultOrg(sb, user, organizations);

    let organizationName = "";
    let role = "";

    const selectedOrg =
      organizations.find((x) => x.organization_id === defaultOrgId) ||
      organizations[0] ||
      null;

    if (selectedOrg) {
      organizationName = selectedOrg.organization_name || "";
      role = selectedOrg.role || "";
    }

    if (!role && isUuid(defaultOrgId)) {
      const derivedRole = await getMyRoleForOrg(sb, defaultOrgId, user);
      role = derivedRole || "";
    }

    const userPayload = {
      id: user.id || null,
      email: user.email || null,
      phone: user.phone || null,
      created_at: user.created_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
      role,
      organization_id: defaultOrgId || null,
      organization_name: organizationName || null,
    };

    return json(200, {
      ok: true,
      user: userPayload,
      organizations: organizations,
      organization_id: defaultOrgId || null,
      organization_name: organizationName || null,
      role: role || null,
      email: user.email || null,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function POST(req) {
  return GET(req);
}