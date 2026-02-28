// src/app/api/ai/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

const normEmail = (s) => String(s || "").trim().toLowerCase();

function cleanMsg(s, max = 2400) {
  return String(s ?? "").trim().slice(0, max);
}

function parseQuotedText(input) {
  const m = String(input || "").match(/"([^"]+)"/);
  return m ? m[1].trim() : "";
}

function parsePixelId(input) {
  const m = String(input || "").match(/(\d{10,20})/);
  return m ? m[1] : "";
}

async function getRole(sb, orgId, email) {
  const { data } = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .eq("is_active", true)
    .maybeSingle();
  return { role: String(data?.role || "").toLowerCase(), active: !!data?.is_active, exists: !!data };
}

function canMarketing(role) {
  return ["owner", "admin", "marketing"].includes(role);
}
function canRead(role) {
  return ["owner", "admin", "ops", "sales", "marketing", "viewer", "staff"].includes(role);
}

async function actionPromo(sb, orgId, on, textMaybe) {
  const payload = {
    organization_id: orgId,
    promo_active: !!on,
    promo_text: on ? (String(textMaybe || "").trim() || "PROMO ACTIVA") : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("site_settings").upsert(payload, { onConflict: "organization_id" });
  if (error) throw new Error(error.message);
  return on
    ? `Listo. Promo activada: "${payload.promo_text}".`
    : "Listo. Promo apagada.";
}

async function actionPixel(sb, orgId, pixelId) {
  const payload = {
    organization_id: orgId,
    pixel_id: String(pixelId || "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("site_settings").upsert(payload, { onConflict: "organization_id" });
  if (error) throw new Error(error.message);
  return payload.pixel_id
    ? `Listo. Pixel configurado: ${payload.pixel_id}.`
    : "Pixel removido (vacío).";
}

async function actionSalesSummary(sb, orgId) {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 864e5).toISOString();

  const { data, error } = await sb
    .from("orders")
    .select("amount_total_mxn, created_at, status")
    .eq("organization_id", orgId)
    .eq("status", "paid")
    .gte("created_at", since)
    .limit(2000);

  if (error) throw new Error(error.message);

  const orders = data || [];
  const gross = orders.reduce((a, o) => a + Number(o.amount_total_mxn || 0), 0);
  const count = orders.length;
  const avg = count ? gross / count : 0;

  return `Resumen últimos 30 días:
• Ventas brutas: ${gross.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
• Pedidos pagados: ${count}
• Ticket promedio: ${avg.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`;
}

async function actionTopCustomers(sb, orgId) {
  const { data, error } = await sb
    .from("orders")
    .select("email, customer_name, amount_total_mxn, status, created_at")
    .eq("organization_id", orgId)
    .eq("status", "paid")
    .limit(5000);

  if (error) throw new Error(error.message);

  const map = new Map();
  for (const o of data || []) {
    const email = String(o.email || "").trim().toLowerCase();
    if (!email) continue;
    const prev = map.get(email) || { email, name: o.customer_name || email, ltv: 0, orders: 0 };
    prev.ltv += Number(o.amount_total_mxn || 0);
    prev.orders += 1;
    map.set(email, prev);
  }

  const top = Array.from(map.values()).sort((a, b) => b.ltv - a.ltv).slice(0, 5);
  if (!top.length) return "Aún no hay clientes con compras pagadas.";

  const lines = top.map(
    (c, i) =>
      `${i + 1}) ${c.name} — ${c.orders} pedidos — ${c.ltv.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
      })}`
  );

  return `Top clientes (LTV):
${lines.join("\n")}`;
}

async function actionPendingShipments(sb, orgId) {
  const { data, error } = await sb
    .from("shipping_labels")
    .select("tracking_number, status, updated_at, carrier")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  const rows = (data || []).filter((r) => {
    const st = String(r.status || "").toLowerCase();
    return st && !["delivered", "entregado", "cancelled", "cancelado"].includes(st);
  });

  if (!rows.length) return "No veo envíos pendientes en los últimos registros.";

  const lines = rows.slice(0, 8).map((r, i) => {
    const st = String(r.status || "—").toUpperCase();
    return `${i + 1}) ${r.tracking_number || "—"} • ${st} • ${r.carrier || "—"}`;
  });

  return `Envíos pendientes (últimos):
${lines.join("\n")}`;
}

// Gemini call (fallback)
async function geminiReply(message, context) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "IA no disponible: falta GEMINI_API_KEY en el servidor.";

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const sys = `Eres Unico IA, asistente ejecutivo para UnicOs Admin (Score Store).
Responde en español, claro, directo, sin tecnicismos innecesarios.
Si el usuario pide acciones, sugiere los comandos:
- "Activa promo: \\"TEXTO\\""
- "Apaga promo"
- "Configura pixel: 123..."
- "Resumen ventas"
- "Top clientes"
- "Envíos pendientes"
Nunca inventes datos; si no puedes leerlos desde DB, dilo y pide el dato mínimo.`;

  const payload = {
    contents: [
      { role: "user", parts: [{ text: `${sys}\n\nContexto:\n${context}\n\nUsuario:\n${message}` }] },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.error?.message || `Gemini error (${res.status})`;
    return `IA error: ${msg}`;
  }

  const text =
    j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
    "OK.";
  return String(text).trim();
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const message = cleanMsg(body?.message);
    const orgId = String(body?.organization_id || "").trim();

    if (!message) return json(400, { ok: false, error: "message requerido." });
    if (!isUuid(orgId)) return json(400, { ok: false, error: "organization_id inválido." });

    const email = normEmail(user?.email);
    const { role, exists } = await getRole(sb, orgId, email);
    if (!exists || !canRead(role)) return json(403, { ok: false, error: "Acceso denegado." });

    const m = message.toLowerCase();

    // === ACTION ROUTER (real DB ops) ===
    // Promo ON
    if (m.includes("activa promo") || m.includes("activar promo")) {
      if (!canMarketing(role)) return json(200, { ok: true, reply: "No tengo permisos para cambiar marketing." });
      const text = parseQuotedText(message) || message.split(":").slice(1).join(":").trim();
      const reply = await actionPromo(sb, orgId, true, text);
      return json(200, { ok: true, reply });
    }

    // Promo OFF
    if (m.includes("apaga promo") || m.includes("desactiva promo")) {
      if (!canMarketing(role)) return json(200, { ok: true, reply: "No tengo permisos para cambiar marketing." });
      const reply = await actionPromo(sb, orgId, false, "");
      return json(200, { ok: true, reply });
    }

    // Pixel
    if (m.includes("configura pixel") || m.includes("configurar pixel") || m.includes("pixel")) {
      if (!canMarketing(role)) return json(200, { ok: true, reply: "No tengo permisos para cambiar el Pixel." });
      const pid = parsePixelId(message);
      if (!pid) return json(200, { ok: true, reply: "Pásame el Pixel ID (solo números) para configurarlo." });
      const reply = await actionPixel(sb, orgId, pid);
      return json(200, { ok: true, reply });
    }

    // Sales summary
    if (m.includes("resumen ventas") || m.includes("ventas") || m.includes("dashboard")) {
      const reply = await actionSalesSummary(sb, orgId);
      return json(200, { ok: true, reply });
    }

    // Top customers
    if (m.includes("top clientes") || (m.includes("clientes") && m.includes("top"))) {
      const reply = await actionTopCustomers(sb, orgId);
      return json(200, { ok: true, reply });
    }

    // Pending shipments
    if (m.includes("envíos pendientes") || m.includes("envios pendientes") || (m.includes("envío") && m.includes("pend"))) {
      const reply = await actionPendingShipments(sb, orgId);
      return json(200, { ok: true, reply });
    }

    // Fallback Gemini
    const context = `Rol: ${role}\nOrg: ${orgId}\n`;
    const reply = await geminiReply(message, context);
    return json(200, { ok: true, reply });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}