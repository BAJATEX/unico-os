// src/app/api/ai/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

function json(status, payload) {
  return NextResponse.json(payload, { status });
}

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const clamp = (v, n = 2500) => String(v ?? "").trim().slice(0, n);

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: "No autorizado. Inicia sesión otra vez." });

    const body = await req.json().catch(() => ({}));
    const prompt = clamp(body.prompt ?? body.message ?? body.text, 2000);
    const orgId = clamp(body.orgId ?? body.organization_id ?? body.organizationId ?? body.org_id, 128);

    if (!prompt || !orgId) {
      return json(400, {
        error: "Faltan datos. Se requiere 'message' o 'prompt' y 'organization_id' u 'orgId'.",
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return json(503, {
        error: "Unico IA está desconectada: falta GEMINI_API_KEY en variables de entorno (Netlify).",
      });
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction:
        "Eres 'Unico IA', el agente ejecutivo-operativo del panel UnicOs. Hablas claro, sin tecnicismos. Si ejecutas acciones (promo, pixel, envíos, clientes, ventas), confirma lo hecho o explica el bloqueo con una solución.",
    });

    const tool_salesSummary = async () => {
      const { data, error } = await sb
        .from("orders")
        .select("amount_total_mxn,status")
        .eq("organization_id", orgId);

      if (error) return `No pude leer ventas (orders). Motivo: ${error.message}`;

      const rows = data || [];
      const paid = rows.filter((o) => String(o.status) === "paid");
      const pending = rows.filter((o) => String(o.status) !== "paid");
      const total = paid.reduce((acc, o) => acc + Number(o.amount_total_mxn || 0), 0);

      return `Ventas: ${paid.length} pagadas, ${pending.length} no pagadas. Ingresos pagados: $${total.toLocaleString("es-MX")} MXN.`;
    };

    const tool_setPromo = async (text) => {
      const promoText = clamp(text, 160);
      const { error } = await sb
        .from("site_settings")
        .upsert(
          {
            organization_id: orgId,
            promo_active: true,
            promo_text: promoText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );

      if (error) return `No pude activar el megáfono. Motivo: ${error.message}`;
      return `Megáfono ACTIVADO. Mensaje: "${promoText}"`;
    };

    const tool_disablePromo = async () => {
      const { error } = await sb
        .from("site_settings")
        .upsert(
          {
            organization_id: orgId,
            promo_active: false,
            promo_text: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );

      if (error) return `No pude apagar el megáfono. Motivo: ${error.message}`;
      return "Megáfono APAGADO.";
    };

    const tool_setPixel = async (pixelIdRaw) => {
      const pixelId = clamp(pixelIdRaw, 80);
      const { error } = await sb
        .from("site_settings")
        .upsert(
          {
            organization_id: orgId,
            pixel_id: pixelId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );

      if (error) return `No pude guardar el Pixel. Motivo: ${error.message}`;
      return `Pixel guardado: ${pixelId}`;
    };

    const tool_pendingShipments = async () => {
      const { data, error } = await sb
        .from("shipping_labels")
        .select("stripe_session_id,tracking_number,status,updated_at")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) return `No pude leer envíos (shipping_labels). Motivo: ${error.message}`;

      const rows = data || [];
      if (!rows.length) return "Envíos: sin registros todavía.";

      const pending = rows.filter(
        (r) => !String(r.status || "").toUpperCase().includes("DELIVER")
      );

      if (!pending.length) return "Envíos: todo está en estado final (entregado / finalizado).";

      return `Envios pendientes (últimos ${pending.length}):\n- ${pending
        .slice(0, 10)
        .map(
          (r) =>
            `${r.status || ""} · tracking=${r.tracking_number || "-"} · session=${
              r.stripe_session_id || "-"
            }`
        )
        .join("\n- ")}`;
    };

    const tool_topCustomers = async () => {
      const { data, error } = await sb
        .from("orders")
        .select("email,customer_name,amount_total_mxn,status")
        .eq("organization_id", orgId)
        .eq("status", "paid")
        .limit(500);

      if (error) return `No pude leer clientes (orders). Motivo: ${error.message}`;

      const map = new Map();
      for (const o of data || []) {
        const email = String(o.email || "").trim().toLowerCase();
        if (!email) continue;
        const rec = map.get(email) || {
          email,
          name: String(o.customer_name || "").trim() || email,
          orders: 0,
          total: 0,
        };
        rec.orders += 1;
        rec.total += Number(o.amount_total_mxn || 0);
        map.set(email, rec);
      }

      const top = Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
      if (!top.length) return "Clientes: todavía no hay ventas pagadas.";

      return `Top clientes (pagado):\n- ${top
        .map((c) => `${c.name} · ${c.orders} compras · $${c.total.toLocaleString("es-MX")} MXN`)
        .join("\n- ")}`;
    };

    const p = prompt.toLowerCase();
    let toolContext = "";

    if (p.includes("promo") || p.includes("megáfono") || p.includes("cintillo")) {
      if (p.includes("apaga") || p.includes("desactiva") || p.includes("quita")) {
        toolContext = await tool_disablePromo();
      } else {
        const m = prompt.match(/"([^"]{3,160})"/);
        if (m && m[1]) toolContext = await tool_setPromo(m[1]);
        else toolContext = "El usuario quiere activar una promo.";
      }
    }

    if (!toolContext && (p.includes("pixel") || p.includes("meta pixel") || p.includes("facebook pixel"))) {
      const m = prompt.match(/(\d{8,20})/);
      if (m && m[1]) toolContext = await tool_setPixel(m[1]);
      else toolContext = "El usuario pidió configurar Pixel, pero no dio el ID.";
    }

    if (!toolContext && (p.includes("venta") || p.includes("ingreso") || p.includes("resumen") || p.includes("dashboard"))) {
      toolContext = await tool_salesSummary();
    }

    if (!toolContext && (p.includes("envío") || p.includes("envios") || p.includes("guía") || p.includes("tracking"))) {
      toolContext = await tool_pendingShipments();
    }

    if (!toolContext && (p.includes("cliente") || p.includes("clientes") || p.includes("top clientes"))) {
      toolContext = await tool_topCustomers();
    }

    if (toolContext === "El usuario quiere activar una promo.") {
      const copyResult = await model.generateContent(
        `Genera SOLO una frase corta (máximo 120 caracteres), persuasiva, en MAYÚSCULAS con 1-2 emojis para un cintillo de tienda. Contexto: "${prompt}"`
      );
      const copy = clamp(copyResult.response.text(), 160);
      toolContext = await tool_setPromo(copy);
      return json(200, { reply: `Listo.\n${toolContext}` });
    }

    if (toolContext === "El usuario pidió configurar Pixel, pero no dio el ID.") {
      return json(200, {
        reply: "Pásame el número del Pixel (solo dígitos) y lo guardo. Ejemplo: 123456789012345.",
      });
    }

    const finalPrompt = toolContext
      ? `Usuario: "${prompt}"\n\nDatos/Acciones reales del sistema:\n${toolContext}\n\nResponde con: (1) resumen ejecutivo corto, (2) siguiente acción recomendada, (3) si aplica, un botón/acción concreta que el usuario pueda hacer en UnicOs.`
      : prompt;

    const result = await model.generateContent(finalPrompt);
    const reply = clamp(result?.response?.text?.() || "", 2500);

    return json(200, { reply: reply || "Sin respuesta." });
  } catch (e) {
    console.error("[Unico IA] error:", e);
    return json(500, { error: "Error interno en Unico IA.", detail: String(e?.message || e) });
  }
}