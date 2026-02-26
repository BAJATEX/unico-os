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

const clampStr = (v, max = 2000) => String(v || "").trim().slice(0, max);

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // FIX REAL: acepta ambos contratos (front viejo y nuevo)
    const prompt = clampStr(body.prompt ?? body.message ?? body.text, 2000);
    const orgId = clampStr(
      body.orgId ?? body.organization_id ?? body.organizationId ?? body.org_id,
      128
    );

    if (!prompt || !orgId) {
      return json(400, {
        error:
          "Faltan datos. Se requiere 'message' o 'prompt' y 'organization_id' u 'orgId'.",
      });
    }

    // Validación llaves IA
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return json(503, {
        error:
          "Unico IA está desconectada: falta GEMINI_API_KEY en variables de entorno (Netlify Production).",
      });
    }

    // Cliente Supabase server-side (requiere secret key en Netlify)
    let sb;
    try {
      sb = serverSupabase();
    } catch (e) {
      return json(503, { error: e?.message || "Falta SUPABASE_SECRET_KEY en Netlify." });
    }

    // Auth real por JWT
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { error: "No autorizado. Vuelve a iniciar sesión." });

    // -----------------------------
    // TOOLS (acciones reales)
    // -----------------------------
    const tool_salesSummary = async () => {
      const { data, error } = await sb
        .from("orders")
        .select("amount_total_mxn,status")
        .eq("organization_id", orgId);

      if (error) return `No pude leer ventas (orders). Motivo: ${error.message}`;

      const paid = (data || []).filter((o) => String(o.status) === "paid");
      const total = paid.reduce((acc, o) => acc + Number(o.amount_total_mxn || 0), 0);

      return `Ventas pagadas: ${paid.length} pedidos. Ingresos: $${total.toLocaleString("es-MX")} MXN.`;
    };

    const tool_setPromo = async (text) => {
      const promoText = clampStr(text, 160);

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

    const tool_lowStock = async () => {
      // Si products no existe en tu DB, esto regresará error claro
      const { data, error } = await sb
        .from("products")
        .select("name,sku,stock")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("stock", { ascending: true })
        .limit(10);

      if (error) return `No pude leer inventario (products). Motivo: ${error.message}`;
      const low = (data || []).filter((p) => Number(p.stock || 0) <= 5);
      if (!low.length) return "Inventario OK: no hay productos críticos (≤5).";
      return `Stock crítico (≤5):\n- ${low
        .map((p) => `${p.sku || "SIN-SKU"} · ${p.name} · stock=${p.stock}`)
        .join("\n- ")}`;
    };

    // Router simple de intención (sin “magia”)
    const p = prompt.toLowerCase();
    let toolContext = "";

    if (p.includes("venta") || p.includes("ingreso") || p.includes("resumen") || p.includes("total")) {
      toolContext = await tool_salesSummary();
    } else if (p.includes("promo") || p.includes("megáfono") || p.includes("cintillo")) {
      // “apaga / desactiva”
      if (p.includes("apaga") || p.includes("desactiva") || p.includes("quita")) {
        toolContext = await tool_disablePromo();
      } else {
        // si no trae texto explícito, Gemini genera el copy y luego lo aplicamos
        toolContext = "El usuario quiere activar una promo.";
      }
    } else if (p.includes("stock") || p.includes("inventario")) {
      toolContext = await tool_lowStock();
    }

    // Gemini (respuesta ejecutiva)
    const genAI = new GoogleGenerativeAI(geminiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction:
        "Eres 'Unico IA', el agente ejecutivo-operativo del panel UnicOs. Respondes claro, sin tecnicismos innecesarios, con pasos accionables. Si el usuario pide acciones (promo/stock/ventas), confirma lo ejecutado o explica por qué no se pudo.",
    });

    // Si pidió promo pero no dio texto, generamos uno y lo activamos
    if (toolContext === "El usuario quiere activar una promo.") {
      const copyResult = await model.generateContent(
        `Genera SOLO una frase corta (máximo 120 caracteres), persuasiva, en MAYÚSCULAS con 1-2 emojis para un cintillo de tienda. Contexto: "${prompt}"`
      );
      const copy = clampStr(copyResult.response.text(), 160);
      toolContext = await tool_setPromo(copy);
      return json(200, { reply: `Listo.\n${toolContext}` });
    }

    const finalPrompt =
      toolContext
        ? `Usuario: "${prompt}"\n\nDatos/Acciones reales del sistema:\n${toolContext}\n\nResponde con un resumen ejecutivo + siguiente acción recomendada.`
        : prompt;

    const result = await model.generateContent(finalPrompt);
    const reply = clampStr(result?.response?.text?.() || result?.response?.text?.() || result?.response?.text?.(), 2500);

    return json(200, { reply: reply || "No obtuve respuesta." });
  } catch (error) {
    console.error("Error en Unico IA:", error);
    return json(500, { error: "Error en el procesamiento neuronal.", detail: error?.message || String(error) });
  }
}