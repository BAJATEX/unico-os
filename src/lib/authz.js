// src/lib/authz.js
export const ROLE_PERMS = {
  owner: ["dashboard", "orders", "products", "marketing", "settings", "users"],
  admin: ["dashboard", "orders", "products", "marketing", "settings", "users"],
  ops: ["dashboard", "orders", "products"],
  sales: ["dashboard", "orders"],
  marketing: ["dashboard", "marketing", "settings"],
  viewer: ["dashboard"]
};

export function hasPerm(role, tab) {
  const r = (role || "viewer").toLowerCase();
  return (ROLE_PERMS[r] || ROLE_PERMS.viewer).includes(tab);
}

export function canManageUsers(role) {
  const r = (role || "viewer").toLowerCase();
  return r === "owner" || r === "admin";
}