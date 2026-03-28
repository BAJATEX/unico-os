export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

function json(status, payload) {
  return NextResponse.json(payload, { status });
}

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const clamp = (v, n = 2500) => String(v ?? "").trim().slice(0, n);
const normEmail = (s) => String(s || "").trim().toLowerCase();

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );

function normalizeGeminiError(e) {
  const msg = String(e?.message || e || "");
  if (/model.*not found|404/i.test(msg)) {
    return "La inteligencia está usando un modelo no disponible. Revisa GEMINI_MODEL en Vercel.";
  }
  if (/api key|unauth|permission|denied|401|403/i.test(msg)) {
    return "La inteligencia no tiene permiso para responder en este momento.";
  }
  return "La inteligencia del panel no pudo completar la solicitud.";
}

async function getMyRole(sb, orgId, user) {
  const myEmail = normEmail(user?.email);
  const uid = user?.id || "00000000-0000-0000-0000-000000000000";

  const q1 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q1?.error && q1?.data?.is_active) return String(q1.data.role || "").toLowerCase();

  const q2 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q2?.data?.is_active) return null;
  return String(q2.data.role || "").toLowerCase();
}

async function selectOrdersByOrg(sb, orgId) {
  const q1 = await sb.from("orders").select("amount_total_mxn,status,created_at").eq("org_id", orgId);
  if (!q1?.error) return q1.data || [];
  const q2 = await sb.from("orders").select("amount_total_mxn,status,created_at").eq("organization_id", orgId);
  return q2.data || [];
}

async function upsertSiteSettings(sb, orgId, payload) {
  const row = {
    ...payload,
    org_id: orgId,
    organization_id: orgId,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await sb.from("site_settings").upsert(row, { onConflict: "org_id" });
    if (error) throw error;
    return null;
  } catch {
    const { error } = await sb.from("site_settings").upsert(row, { onConflict: "organization_id" });
    return error || null;
  }
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: "Tu acceso venció. Entra otra vez." });

    const body = await req.json().catch(() => ({}));
    const prompt = clamp(body.prompt ?? body.message ?? body.text, 2000);
    const orgId = clamp(body.orgId ?? body.organization_id ?? body.organizationId ?? body.org_id, 128);

    if (!prompt || !orgId) return json(400, { error: "Faltan datos para atender la solicitud." });
    if (!isUuid(orgId)) return json(400, { error: "La organización enviada no es válida." });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !hasPerm(role, "dashboard")) {
      return json(403, { error: "No tienes permiso para usar esta sección." });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return json(503, { error: "La inteligencia del panel no está conectada." });

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction:
        "Eres UnicOs IA, la agente operativa del panel maestro de Único. Explicas todo en español claro, con tono ejecutivo, comercial y entendible. Nada de tecnicismos innecesarios. Si puedes ejecutar algo real desde el panel, lo haces y luego confirmas qué cambió. Si no puedes hacerlo, explicas qué falta y cuál sería el siguiente paso sin sonar técnico.",
    });

    const tool_salesSummary = async () => {
      const rows = await selectOrdersByOrg(sb, orgId);
      const paid = (rows || []).filter((o) => ["paid", "fulfilled"].includes(String(o.status || "").toLowerCase()));
      const pending = (rows || []).filter((o) => !["paid", "fulfilled"].includes(String(o.status || "").toLowerCase()));
      const total = paid.reduce((acc, o) => acc + Number(o.amount_total_mxn || 0), 0);
      return `Resumen actual: ${paid.length} pedidos pagados, ${pending.length} pendientes y ventas confirmadas por $${total.toLocaleString("es-MX")} MXN.`;
    };

    const tool_setPromo = async (text) => {
      if (!hasPerm(role, "marketing")) return "No tienes permiso para cambiar promociones desde este perfil.";
      const promoText = clamp(text, 160);
      const err = await upsertSiteSettings(sb, orgId, { promo_active: true, promo_text: promoText });
      if (err) return `No pude activar el aviso comercial. Motivo: ${err.message}`;
      return `Aviso comercial activado con este mensaje: "${promoText}"`;
    };

    const tool_disablePromo = async () => {
      if (!hasPerm(role, "marketing")) return "No tienes permiso para apagar promociones desde este perfil.";
      const err = await upsertSiteSettings(sb, orgId, { promo_active: false, promo_text: null });
      if (err) return `No pude apagar el aviso comercial. Motivo: ${err.message}`;
      return "Aviso comercial desactivado.";
    };

    const tool_setPixel = async (pixelIdRaw) => {
      if (!hasPerm(role, "marketing") && !hasPerm(role, "integrations")) {
        return "No tienes permiso para cambiar este seguimiento.";
      }
      const pixelId = clamp(pixelIdRaw, 80);
      const err = await upsertSiteSettings(sb, orgId, { pixel_id: pixelId });
      if (err) return `No pude guardar ese seguimiento. Motivo: ${err.message}`;
      return "Seguimiento guardado correctamente.";
    };

    const p = prompt.toLowerCase();
    let toolContext = "";

    if (p.includes("ventas") || p.includes("reporte") || p.includes("ingresos") || p.includes("estatus")) {
      toolContext += "\n" + (await tool_salesSummary());
    }
    if (p.includes("activar promo") || p.includes("publica promo") || p.includes("poner promo")) {
      toolContext += "\nTOOL_HINT: setPromo('<texto>')";
    }
    if (p.includes("apagar promo") || p.includes("desactivar promo") || p.includes("quitar promo")) {
      toolContext += "\nTOOL_HINT: disablePromo()";
    }
    if (p.includes("pixel") || p.includes("seguimiento")) {
      toolContext += "\nTOOL_HINT: setPixel('<id>')";
    }

    const input = `CONTEXTO\nOrganización=${orgId}\nPerfil=${role}\n${toolContext}\n\nSOLICITUD DEL USUARIO\n${prompt}\n\nRESPONDE DE FORMA CLARA, HUMANA Y DIRECTA.`;

    let reply = "";
    try {
      const out = await model.generateContent(input);
      reply = out?.response?.text?.() || "Listo.";
    } catch (e) {
      return json(500, { error: normalizeGeminiError(e) });
    }

    const exec = async () => {
      const r = reply || "";
      const m1 = r.match(/setPromo\(['"`](.+?)['"`]\)/i);
      const m2 = r.match(/disablePromo\(\)/i);
      const m3 = r.match(/setPixel\(['"`](.+?)['"`]\)/i);

      const logs = [];
      if (m1) logs.push(await tool_setPromo(m1[1]));
      if (m2) logs.push(await tool_disablePromo());
      if (m3) logs.push(await tool_setPixel(m3[1]));

      if (logs.length) reply += `\n\nHecho:\n- ${logs.join("\n- ")}`;
    };

    await exec();

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(user?.email),
      actor_user_id: user?.id || null,
      action: "ai.chat",
      entity: "ai",
      entity_id: "gemini",
      summary: "AI request processed",
      meta: { len: prompt.length },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json(200, { ok: true, reply });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}