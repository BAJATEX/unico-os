// src/lib/authz.js
"use strict";

/**
 * Matriz de Control de Acceso Basado en Roles (RBAC) para UnicOs.
 * Define exactamente qué vistas y acciones puede ejecutar cada rol.
 */
export const ROLE_PERMS = {
  owner: ["dashboard", "orders", "products", "marketing", "settings", "users", "crm"],
  admin: ["dashboard", "orders", "products", "marketing", "settings", "users", "crm"],
  ops: ["orders", "products"],
  sales: ["orders", "crm"],
  marketing: ["marketing", "products", "dashboard"],
  viewer: ["dashboard"]
};

/**
 * Verifica si un rol tiene acceso a un módulo específico.
 * @param {string} role - El rol del usuario (ej. 'admin').
 * @param {string} module - El módulo a verificar (ej. 'orders').
 * @returns {boolean}
 */
export const hasPerm = (role, module) => {
  if (!role) return false;
  const normalizedRole = String(role).toLowerCase().trim();
  return ROLE_PERMS[normalizedRole]?.includes(module) || false;
};

/**
 * Regla de negocio estricta: Solo dueños y administradores pueden gestionar accesos.
 */
export const canManageUsers = (role) => {
  if (!role) return false;
  const normalizedRole = String(role).toLowerCase().trim();
  return ["owner", "admin"].includes(normalizedRole);
};

/**
 * Regla de negocio estricta: Roles autorizados para mutar finanzas/reembolsos.
 */
export const canRefund = (role) => {
  if (!role) return false;
  const normalizedRole = String(role).toLowerCase().trim();
  return ["owner", "admin"].includes(normalizedRole);
};