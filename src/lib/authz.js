export const ROLE_PERMS = {
  owner: ["dashboard", "orders", "products", "marketing", "settings", "users"],
  admin: ["dashboard", "orders", "products", "marketing", "settings", "users"],
  ops: ["dashboard", "orders", "products"],
  sales: ["dashboard", "orders"],
  marketing: ["dashboard", "marketing", "settings"],
  viewer: ["dashboard"]
};

export const VALID_ROLES = ["owner", "admin", "ops", "sales", "marketing", "viewer"];

export function hasPerm(role, tab) {
  const r = (role || "viewer").toLowerCase();
  return (ROLE_PERMS[r] || ROLE_PERMS.viewer).includes(tab);
}

export function canManageUsers(role) {
  const r = (role || "viewer").toLowerCase();
  return r === "owner" || r === "admin";
}

export function canWriteOrders(role) {
  const r = (role || "viewer").toLowerCase();
  return ["owner", "admin", "ops", "sales"].includes(r);
}

export function normalizeRole(role) {
  const r = String(role || "viewer").toLowerCase().trim();
  return VALID_ROLES.includes(r) ? r : "viewer";
}