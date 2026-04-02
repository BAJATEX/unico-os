// src/lib/authz.js
"use strict";

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

export function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return ROLE_PRIORITY.has(r) ? r : "viewer";
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

export function canManageUsers(role) {
  return hasPerm(role, "invite") || roleRank(role) >= roleRank("admin");
}

export function canManageMoney(role) {
  return hasPerm(role, "finance") || roleRank(role) >= roleRank("admin");
}

export function canManageShipping(role) {
  return hasPerm(role, "shipping") || roleRank(role) >= roleRank("ops");
}

export function canManageContent(role) {
  return hasPerm(role, "products") || hasPerm(role, "settings") || roleRank(role) >= roleRank("marketing");
}