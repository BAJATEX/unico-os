// src/app/api/orders/update/route.js
export const dynamic = "force-dynamic";

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

const normEmail = (s) => String(s || "").trim().toLowerCase();

const ALLOWED_ORDER_PATCH_KEYS = new Set(["status"]);
const ALLOWED_STATUS = new Set([
  "pending",
  "pending_payment",
  "paid",
  "payment_failed",
  "fulfilled",
  "cancelled",
]);

function sanitizePatch(patch) {
  const clean = {};
  const src = patch && typeof patch === "object" ? patch : {};
  for (const k of Object.keys(src)) {
    if (!ALLOWED_ORDER_PATCH_KEYS.has(k)) continue;
    clean[k] = src[k];
  }

  if ("status" in clean) {
    const v = String(clean.status || "").trim().toLowerCase();
    if (!ALLOWED_STATUS.has(v)) delete clean.status;
    else clean.status = v;
  }

  return clean;
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const org_id = String(body?.org_id || "").trim();
    const order_id = String(body?.order_id || "").trim();
    const patch = body?.patch;

    if (!org_id || !order_id || !patch) {
      return json(400, { error: "Faltan datos requeridos" });
    }

    const requesterEmail = normEmail(user?.email);

    // FIX REAL: `.is()` es para NULL. Para boolean debe ser `.eq()`.
    const { data: mem, error: memErr } = await sb
      .from("admin_users")
      .select("role")
      .eq("organization_id", org_id)
      .eq("email", requesterEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (memErr) return json(500, { error: memErr.message });
    if (!mem) return json(403, { error: "Acceso denegado: Usuario inactivo o sin membresía." });

    const role = String(mem?.role || "viewer").toLowerCase();
    const canWrite = ["owner", "admin", "ops"].includes(role);
    if (!canWrite) return json(403, { error: "Permisos insuficientes" });

    const cleanPatch = sanitizePatch(patch);
    if (!Object.keys(cleanPatch).length) {
      return json(400, { error: "No hay campos permitidos para actualizar" });
    }

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
    return json(500, { error: String(e?.message || "Server error") });
  }
}