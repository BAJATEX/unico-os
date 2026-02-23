// src/app/api/orders/update/route.js
import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

function json(status, body) {
  return NextResponse.json(body, { status });
}

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

// CORRECCIÓN: Solo permitimos el estatus porque los demás campos no existen en Score Store.
const ALLOWED_ORDER_PATCH_KEYS = new Set([
  "status"
]);

function sanitizePatch(patch) {
  const clean = {};
  const src = patch && typeof patch === "object" ? patch : {};
  for (const k of Object.keys(src)) {
    if (ALLOWED_ORDER_PATCH_KEYS.has(k)) clean[k] = src[k];
  }
  return clean;
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    // 1) user real
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: authErr });

    // 2) body
    const body = await req.json();
    const { org_id, order_id, patch } = body || {};
    if (!org_id || !order_id || !patch) {
      return json(400, { error: "Faltan datos requeridos (org_id, order_id, patch)" });
    }

    // 3) CORRECCIÓN CRÍTICA: Validar en tabla admin_users de Score Store por Email
    const { data: mem, error: memErr } = await sb
      .from("admin_users")
      .select("role")
      .eq("organization_id", org_id)
      .eq("email", user.email)
      .is("is_active", true)
      .maybeSingle();

    if (memErr) return json(500, { error: memErr.message });

    const role = (mem?.role || "viewer").toLowerCase();
    const canWrite = ["owner", "admin", "ops"].includes(role);
    if (!canWrite) return json(403, { error: "Permisos insuficientes" });

    // 4) sanitize patch
    const cleanPatch = sanitizePatch(patch);
    if (!Object.keys(cleanPatch).length) {
      return json(400, { error: "No hay campos permitidos para actualizar" });
    }

    // 5) update (Corrigiendo a organization_id)
    const { data, error } = await sb
      .from("orders")
      .update(cleanPatch)
      .eq("organization_id", org_id)
      .eq("id", order_id)
      .select("*")
      .single();

    if (error) return json(500, { error: error.message });

    return json(200, { ok: true, order: data });
  } catch (e) {
    return json(500, { error: e?.message || "Server error" });
  }
}