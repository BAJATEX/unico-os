// src/lib/dbScope.js
"use strict";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROLE_PRIORITY = new Map([
  ["owner", 100],
  ["admin", 90],
  ["marketing", 70],
  ["ops", 70],
  ["support", 60],
  ["finance", 60],
  ["viewer", 10],
]);

const ROLE_PERMISSIONS = {
  owner: new Set([
    "dashboard",
    "orders",
    "products",
    "settings",
    "audit",
    "finance",
    "shipping",
    "ai",
    "invite",
    "org",
  ]),
  admin: new Set([
    "dashboard",
    "orders",
    "products",
    "settings",
    "audit",
    "finance",
    "shipping",
    "ai",
    "invite",
    "org",
  ]),
  marketing: new Set(["dashboard", "products", "settings", "ai", "audit"]),
  ops: new Set(["dashboard", "orders", "products", "shipping", "audit", "ai"]),
  support: new Set(["dashboard", "orders", "shipping", "audit"]),
  finance: new Set(["dashboard", "orders", "finance", "audit"]),
  viewer: new Set(["dashboard"]),
};

export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

export function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ROLE_PRIORITY.has(value) ? value : "viewer";
}

export function roleRank(role) {
  return ROLE_PRIORITY.get(normalizeRole(role)) || 0;
}

export function hasPerm(role, permission) {
  const r = normalizeRole(role);
  const p = String(permission || "").trim().toLowerCase();

  if (!p) return false;
  if (r === "owner") return true;

  const perms = ROLE_PERMISSIONS[r];
  return perms ? perms.has(p) : false;
}

function rowOrgId(row) {
  return String(row?.org_id || row?.organization_id || "").trim();
}

function isMatchingIdentity(row, user) {
  const uid = String(user?.id || "").trim();
  const email = normEmail(user?.email);
  const rowUid = String(row?.user_id || "").trim();
  const rowEmail = normEmail(row?.email);

  if (uid && rowUid && rowUid === uid) return true;
  if (email && rowEmail && rowEmail === email) return true;

  return false;
}

function bestRoleFromRows(rows, user) {
  let best = null;
  let bestRank = -1;

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.is_active) continue;
    if (!isMatchingIdentity(row, user)) continue;

    const role = normalizeRole(row.role);
    const rank = roleRank(role);
    if (rank > bestRank) {
      best = role;
      bestRank = rank;
    }
  }

  return best;
}

async function fetchCandidates(sb, orgId, column) {
  const { data, error } = await sb
    .from("admin_users")
    .select("role,is_active,user_id,email,org_id,organization_id")
    .eq(column, orgId)
    .eq("is_active", true)
    .limit(200);

  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function getMyRoleForOrg(sb, orgId, user) {
  const cleanOrgId = String(orgId || "").trim();
  if (!isUuid(cleanOrgId) || !sb) return null;

  const byOrgId = await fetchCandidates(sb, cleanOrgId, "org_id");
  const role1 = bestRoleFromRows(byOrgId, user);
  if (role1) return role1;

  const byOrganizationId = await fetchCandidates(sb, cleanOrgId, "organization_id");
  const role2 = bestRoleFromRows(byOrganizationId, user);
  if (role2) return role2;

  return null;
}

export function applyOrgFilter(query, orgId) {
  const cleanOrgId = String(orgId || "").trim();
  if (!query || !cleanOrgId) return query;

  return query.or(`org_id.eq.${cleanOrgId},organization_id.eq.${cleanOrgId}`);
}

export async function selectOrdersByOrg(sb, orgId, select = "*") {
  const q = sb.from("orders").select(select);
  return applyOrgFilter(q, orgId);
}

export async function selectOneOrderByOrg(sb, orgId, orderId, select = "*") {
  const q = sb.from("orders").select(select).eq("id", orderId);
  const filtered = applyOrgFilter(q, orgId);
  return filtered.maybeSingle();
}

export async function selectAuditByOrg(sb, orgId, select = "*") {
  const q = sb.from("audit_log").select(select);
  return applyOrgFilter(q, orgId);
}

export function pickOrgId(row) {
  return rowOrgId(row);
}

export function isOrgRow(row, orgId) {
  const cleanOrgId = String(orgId || "").trim();
  if (!cleanOrgId) return false;
  return rowOrgId(row) === cleanOrgId;
}