// src/app/api/ai/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const MAX_MESSAGE_LEN = 1800;

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

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clampText(v, max = MAX_MESSAGE_LEN) {
  return String(v ?? "").trim().slice(0, max);
}

function normalizeBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return fallback;
}

function normalizeStatus(v) {
  return safeStr(v).trim().toLowerCase();
}

function parseOrgId(body = {}, url = null) {
  const fromBody = safeStr(body?.org_id || body?.orgId || body?.organization_id || "").trim();
  if (fromBody) return fromBody;

  const fromQuery = url
    ? safeStr(url.searchParams.get("org_id") || url.searchParams.get("orgId") || "").trim()
    : "";

  return fromQuery;
}

function parseMessage(body = {}) {
  const msg = body?.message ?? body?.prompt ?? body?.text ?? "";
  return clampText(msg);
}

function parseContext(body = {}) {
  const ctx = body?.context && typeof body.context === "object" ? body.context : {};
  return {
    currentProduct: safeStr(ctx.currentProduct || ctx.product || ctx.currentSku || ""),
    currentSku: safeStr(ctx.currentSku || ctx.sku || ""),
    cartItems: safeStr(ctx.cartItems || ctx.cart || ""),
    cartTotal: safeStr(ctx.cartTotal || ctx.total || ""),
    shipMode: safeStr(ctx.shipMode || ctx.shippingMode || ""),
    orderId: safeStr(ctx.orderId || ctx.order_id || ""),
    actionHint: safeStr(ctx.actionHint || ctx.action || ""),
  };
}

function formatCurrencyMXN(value) {
  const n = safeNum(value, 0);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(n);
}

function flattenSettings(row) {
  if (!row) return null;

  const theme = row.theme && typeof row.theme === "object" ? row.theme : {};
  const home = row.home && typeof row.home === "object" ? row.home : {};
  const socials = row.socials && typeof row.socials === "object" ? row.socials : {};

  return {
    hero_title: row.hero_title || null,
    hero_image: row.hero_image || null,
    promo_active: normalizeBool(row.promo_active, false),
    promo_text: safeStr(row.promo_text),
    pixel_id: safeStr(row.pixel_id),
    maintenance_mode: normalizeBool(row.maintenance_mode, false),
    season_key: safeStr(row.season_key || "default"),
    theme: {
      accent: safeStr(theme.accent || "#e10600"),
      accent2: safeStr(theme.accent2 || "#111111"),
      particles: normalizeBool(theme.particles, true),
    },
    home: {
      footer_note: safeStr(home.footer_note),
      shipping_note: safeStr(home.shipping_note),
      returns_note: safeStr(home.returns_note),
      support_hours: safeStr(home.support_hours),
    },
    socials: {
      facebook: safeStr(socials.facebook),
      instagram: safeStr(socials.instagram),
      youtube: safeStr(socials.youtube),
      tiktok: safeStr(socials.tiktok),
    },
    contact: {
      email: safeStr(row.contact_email),
      phone: safeStr(row.contact_phone),
      whatsapp_e164: safeStr(row.whatsapp_e164),
      whatsapp_display: safeStr(row.whatsapp_display),
    },
    updated_at: row.updated_at || null,
  };
}

function summarizeOrders(rows = []) {
  const orders = Array.isArray(rows) ? rows : [];
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => {
    const status = normalizeStatus(o?.status || "");
    const payment = normalizeStatus(o?.payment_status || "");
    return status === "paid" || status === "fulfilled" || payment === "paid";
  });
  const pendingOrders = orders.filter((o) => {
    const status = normalizeStatus(o?.status || "");
    return ["pending", "pending_payment", "payment_failed"].includes(status);
  });
  const refundedOrders = orders.filter((o) => {
    const status = normalizeStatus(o?.status || "");
    const payment = normalizeStatus(o?.payment_status || "");
    return status === "refunded" || payment === "refunded";
  });

  const valueMXN = orders.reduce((acc, row) => {
    const cents =
      safeNum(row?.amount_total_cents, NaN) ||
      safeNum(row?.total_cents, NaN) ||
      safeNum(row?.subtotal_cents, NaN) ||
      0;
    if (Number.isFinite(cents) && cents > 0) return acc + cents / 100;

    const mxn =
      safeNum(row?.amount_total_mxn, NaN) ||
      safeNum(row?.total_mxn, NaN) ||
      safeNum(row?.subtotal_mxn, NaN) ||
      0;

    return acc + safeNum(mxn, 0);
  }, 0);

  return {
    totalOrders,
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    refundedOrders: refundedOrders.length,
    valueMXN: Math.round(valueMXN * 100) / 100,
    recent: orders.slice(0, 6).map((o) => ({
      id: safeStr(o?.id),
      status: safeStr(o?.status || o?.payment_status || "pending"),
      amount: formatCurrencyMXN(
        (safeNum(o?.amount_total_cents, NaN) || safeNum(o?.total_cents, NaN) || 0) / 100
      ),
      created_at: o?.created_at || null,
      customer_email: safeStr(o?.customer_email || o?.email || ""),
    })),
  };
}

function summarizeProducts(rows = []) {
  const products = Array.isArray(rows) ? rows : [];
  const active = products.filter((p) => p?.deleted_at == null && p?.is_active !== false && p?.active !== false);
  const lowStock = active.filter((p) => safeNum(p?.stock, 0) <= 5);
  return {
    totalProducts: products.length,
    activeProducts: active.length,
    lowStockProducts: lowStock.length,
    recent: products.slice(0, 6).map((p) => ({
      id: safeStr(p?.id),
      name: safeStr(p?.name || ""),
      sku: safeStr(p?.sku || ""),
      stock: safeNum(p?.stock, 0),
      price_mxn: safeNum(p?.price_mxn, 0),
      active: p?.deleted_at == null && p?.is_active !== false && p?.active !== false,
    })),
  };
}

function summarizeAudit(rows = []) {
  const audit = Array.isArray(rows) ? rows : [];
  return {
    totalAudit: audit.length,
    recent: audit.slice(0, 8).map((r) => ({
      id: safeStr(r?.id),
      action: safeStr(r?.action || ""),
      entity: safeStr(r?.entity || ""),
      summary: safeStr(r?.summary || ""),
      actor_email: safeStr(r?.actor_email || "Sistema"),
      created_at: r?.created_at || null,
    })),
  };
}

async function loadOrgContext(sb, orgId) {
  const orgFilter = `org_id.eq.${orgId},organization_id.eq.${orgId}`;

  const [settingsRes, ordersRes, productsRes, auditRes, orgRes] = await Promise.all([
    sb
      .from("site_settings")
      .select(
        [
          "organization_id",
          "org_id",
          "hero_title",
          "hero_image",
          "promo_active",
          "promo_text",
          "pixel_id",
          "maintenance_mode",
          "season_key",
          "theme",
          "home",
          "socials",
          "contact_email",
          "contact_phone",
          "whatsapp_e164",
          "whatsapp_display",
          "updated_at",
        ].join(", ")
      )
      .or(orgFilter)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("orders")
      .select(
        [
          "id",
          "status",
          "payment_status",
          "amount_total_cents",
          "total_cents",
          "subtotal_cents",
          "amount_total_mxn",
          "total_mxn",
          "subtotal_mxn",
          "customer_email",
          "created_at",
          "org_id",
          "organization_id",
        ].join(", ")
      )
      .or(orgFilter)
      .order("created_at", { ascending: false })
      .limit(25),
    sb
      .from("products")
      .select(
        [
          "id",
          "name",
          "sku",
          "price_mxn",
          "stock",
          "active",
          "is_active",
          "deleted_at",
          "rank",
          "section_id",
          "sub_section",
          "org_id",
          "organization_id",
        ].join(", ")
      )
      .or(orgFilter)
      .order("rank", { ascending: true })
      .limit(25),
    sb
      .from("audit_log")
      .select("id, created_at, actor_email, action, entity, summary, org_id, organization_id")
      .or(orgFilter)
      .order("created_at", { ascending: false })
      .limit(15),
    sb
      .from("organizations")
      .select("id, name, slug")
      .eq("id", orgId)
      .maybeSingle(),
  ]);

  const settings = settingsRes?.error ? null : flattenSettings(settingsRes?.data || null);
  const orders = ordersRes?.error ? [] : Array.isArray(ordersRes?.data) ? ordersRes.data : [];
  const products = productsRes?.error ? [] : Array.isArray(productsRes?.data) ? productsRes.data : [];
  const audit = auditRes?.error ? [] : Array.isArray(auditRes?.data) ? auditRes.data : [];

  return {
    organization: orgRes?.data || null,
    settings,
    orders: summarizeOrders(orders),
    products: summarizeProducts(products),
    audit: summarizeAudit(audit),
    counts: {
      orders: orders.length,
      products: products.length,
      audit: audit.length,
    },
  };
}

function buildSystemPrompt({ orgName, role, settings, orders, products, audit, context }) {
  const publicEmail = settings?.contact?.email || "No disponible";
  const publicPhone = settings?.contact?.phone || "No disponible";
  const publicWhatsApp = settings?.contact?.whatsapp_display || "No disponible";
  const supportHours = settings?.home?.support_hours || "No especificado";
  const shippingNote = settings?.home?.shipping_note || "No disponible";
  const returnsNote = settings?.home?.returns_note || "No disponible";
  const promoText = settings?.promo_text || "Sin promo activa";
  const heroTitle = settings?.hero_title || orgName || "UnicOs";

  return `
Eres UnicOs AI, el asistente operativo del admin para Score Store / Único Uniformes.

OBJETIVO:
- Resolver dudas operativas del panel.
- Explicar estado de pedidos, catálogo, settings, finanzas, envíos, auditoría y automatizaciones.
- Proponer acciones concretas, seguras y ejecutables en el panel.
- Responder en español claro, corto y útil.

REGLAS DURAS:
- No inventes precios, stock, estados, promos ni tiempos exactos.
- Si faltan datos, dilo de frente y sugiere el siguiente paso útil.
- No expongas secretos, llaves, tokens ni SQL.
- Si el usuario pide cambios, responde con la acción exacta que debería ejecutarse, sin afirmar que ya se ejecutó salvo que el sistema lo confirme.
- Prioriza precisión operativa por encima de estilo.

CONTEXTO DE ORGANIZACIÓN:
- Organización activa: ${orgName || "Sin nombre"}
- Rol del usuario: ${role || "desconocido"}
- Hero / referencia pública: ${heroTitle}
- Promo visible: ${settings?.promo_active ? "activa" : "inactiva"}
- Promo text: ${promoText}
- Modo mantenimiento: ${settings?.maintenance_mode ? "sí" : "no"}
- Nota envíos: ${shippingNote}
- Nota devoluciones: ${returnsNote}
- Horario soporte: ${supportHours}
- Contacto público: ${publicEmail}
- Teléfono: ${publicPhone}
- WhatsApp: ${publicWhatsApp}

RESUMEN OPERATIVO:
- Pedidos recientes: ${orders.totalOrders}
- Pedidos pagados: ${orders.paidOrders}
- Pedidos pendientes: ${orders.pendingOrders}
- Pedidos reembolsados: ${orders.refundedOrders}
- Valor visible reciente: ${orders.valueMXN} MXN
- Productos activos: ${products.activeProducts}
- Productos con stock bajo: ${products.lowStockProducts}
- Registros de auditoría recientes: ${audit.totalAudit}

USO DE CONTEXTO DEL USUARIO:
- Producto actual: ${safeStr(context.currentProduct || "Ninguno")}
- SKU actual: ${safeStr(context.currentSku || "Ninguno")}
- Carrito actual: ${safeStr(context.cartItems || "Sin datos")}
- Total visible: ${safeStr(context.cartTotal || "Sin datos")}
- Modo de envío visible: ${safeStr(context.shipMode || "Sin datos")}
- Pedido en foco: ${safeStr(context.orderId || "Ninguno")}
- Sugerencia de acción: ${safeStr(context.actionHint || "Ninguna")}

INSTRUCCIONES:
- Si te preguntan por pedidos, usa el resumen operativo.
- Si te preguntan por catálogo, habla solo de productos visibles y stock.
- Si te preguntan por settings, usa el estado de promo, mantenimiento, hero y notas públicas.
- Si te preguntan por finanzas, habla en términos simples y con prudencia.
- Si te piden una acción, descríbela como paso claro y exacto.
- Si la información no está disponible, dilo sin rodeos.
`.trim();
}

function extractTextFromGeminiResponse(response) {
  try {
    const text = response?.text?.();
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch {}

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => safeStr(p?.text || ""))
    .join("")
    .trim();

  return text || "";
}

function normalizeGeminiError(e) {
  const msg = String(e?.message || e || "");
  if (/model.*not found|404/i.test(msg)) {
    return "El modelo de IA configurado no está disponible. Revisa GEMINI_MODEL en Vercel.";
  }
  if (/api key|unauth|permission|denied|401|403/i.test(msg)) {
    return "La IA no tiene permiso o llave válida en este momento.";
  }
  return "La IA del panel no pudo completar la solicitud.";
}

function parseActionMarkers(text) {
  const out = [];
  const regex = /\[ACTION:([A-Z_]+)(?::([^\]]+))?\]/g;
  const raw = String(text || "");

  for (const match of raw.matchAll(regex)) {
    out.push({
      action: safeStr(match[1]).toUpperCase(),
      value: safeStr(match[2]).trim(),
    });
  }

  return out;
}

function stripActionMarkers(text) {
  return String(text || "")
    .replace(/\[ACTION:[A-Z_]+(?::[^\]]+)?\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function callGemini({ apiKey, model, systemText, userText }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const gm = genAI.getGenerativeModel({
    model,
    systemInstruction: systemText,
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
  });

  const result = await gm.generateContent(userText);
  const response = result?.response;
  const text = extractTextFromGeminiResponse(response);

  return { response, text };
}

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json(401, { ok: false, error: "No autorizado" }) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "ai")) {
    return { ok: false, res: json(403, { ok: false, error: "Permisos insuficientes" }) };
  }

  return { ok: true, user, role };
}

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return json(200, {
        ok: false,
        error: "La IA no está conectada en este momento.",
      });
    }

    const sb = serverSupabase();
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);

    const orgId = parseOrgId(body, url);
    const message = parseMessage(body);
    const context = parseContext(body);

    if (!isUuid(orgId)) {
      return json(400, { ok: false, error: "org_id inválido" });
    }

    if (!message) {
      return json(400, { ok: false, error: "Se requiere un mensaje válido." });
    }

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const orgContext = await loadOrgContext(sb, orgId);
    const orgName =
      safeStr(orgContext?.organization?.name || orgContext?.organization?.slug || "") ||
      "Organización";

    const systemText = buildSystemPrompt({
      orgName,
      role: auth.role,
      settings: orgContext.settings,
      orders: orgContext.orders,
      products: orgContext.products,
      audit: orgContext.audit,
      context,
    });

    const preferredModel = safeStr(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const fallbackModel = safeStr(process.env.GEMINI_FALLBACK_MODEL || FALLBACK_MODEL).trim();

    let geminiResult;
    let usedModel = preferredModel;

    try {
      geminiResult = await callGemini({
        apiKey,
        model: preferredModel,
        systemText,
        userText: message,
      });
    } catch (e) {
      const errMsg = String(e?.message || e || "");
      const looksLikeModelIssue = /model.*not found|404/i.test(errMsg);

      if (looksLikeModelIssue && fallbackModel && fallbackModel !== preferredModel) {
        usedModel = fallbackModel;
        geminiResult = await callGemini({
          apiKey,
          model: fallbackModel,
          systemText,
          userText: message,
        });
      } else {
        return json(200, {
          ok: false,
          error: normalizeGeminiError(e),
        });
      }
    }

    const rawReply = safeStr(geminiResult?.text || "No pude generar una respuesta en este momento.");
    const reply = stripActionMarkers(rawReply);
    const actions = parseActionMarkers(rawReply);

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "ai.chat",
      entity: "ai",
      entity_id: orgId,
      summary: clampText(message, 220),
      after: {
        reply_preview: clampText(reply, 400),
        actions,
      },
      meta: {
        role: auth.role,
        model: usedModel,
        source: "api/ai",
        context: {
          currentProduct: context.currentProduct || null,
          currentSku: context.currentSku || null,
          orderId: context.orderId || null,
          actionHint: context.actionHint || null,
        },
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, {
      ok: true,
      reply,
      actions,
      model: usedModel,
      org_id: orgId,
      org_name: orgName,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function GET() {
  return json(405, { ok: false, error: "Method not allowed" });
}

export async function OPTIONS() {
  return json(204, {});
}