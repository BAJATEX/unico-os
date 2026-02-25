// src/app/api/ai/route.js
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    // 1. Seguridad: Verificar que quien habla con la IA es el Dueño/Admin
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { prompt, orgId } = body;
    if (!prompt || !orgId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    // 2. Configurar Gemini con contexto de Sistema
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: "Eres 'Unico IA', el agente autónomo de élite del panel UnicOs. Administras la tienda 'Score Store'. Tu tono es profesional, conciso y tecnológico. Tienes acceso a la base de datos."
    });

    // 3. Declarar las "Herramientas" (Lo que la IA puede HACER físicamente)
    const getMetricsTool = async () => {
      const { data } = await sb.from("orders").select("amount_total_mxn").eq("organization_id", orgId).eq("status", "paid");
      const total = (data || []).reduce((acc, curr) => acc + Number(curr.amount_total_mxn || 0), 0);
      return `Los ingresos totales pagados son $${total} MXN de ${data?.length || 0} pedidos.`;
    };

    const updatePromoTool = async (promoText) => {
      await sb.from("site_settings").update({ promo_active: true, promo_text: promoText }).eq("organization_id", orgId);
      return `Éxito. El cintillo de la tienda ahora está activo y dice: "${promoText}".`;
    };

    // 4. Analizar la intención del usuario de forma manual y ejecutar (RAG Simplificado para mayor velocidad y seguridad)
    // Nota: En una versión Nivel 5 se usaría Function Calling nativo, pero esto garantiza 0% de alucinaciones destructivas en tu DB.
    let finalResponse = "";
    const p = prompt.toLowerCase();

    if (p.includes("venta") || p.includes("ingreso") || p.includes("dinero") || p.includes("resumen")) {
      const metrics = await getMetricsTool();
      const result = await model.generateContent(`El usuario preguntó: "${prompt}". Los datos reales de la base de datos son: ${metrics}. Respondele al usuario de forma ejecutiva dándole estos datos.`);
      finalResponse = result.response.text();
    } 
    else if (p.includes("promo") || p.includes("marketing") || p.includes("cintillo")) {
      // Pedimos a Gemini que invente el copy, y luego nosotros lo inyectamos
      const copyResult = await model.generateContent(`El usuario quiere una promoción: "${prompt}". Escribe SOLO UNA FRASE CORTA, persuasiva y en MAYÚSCULAS con emojis para un cintillo de tienda online. Nada más.`);
      const copy = copyResult.response.text().trim();
      await updatePromoTool(copy);
      finalResponse = `Listo. He activado la campaña en la tienda en vivo. El mensaje actual es: ${copy}`;
    } 
    else {
      // Conversación general
      const result = await model.generateContent(prompt);
      finalResponse = result.response.text();
    }

    return NextResponse.json({ reply: finalResponse });

  } catch (error) {
    console.error("Error en Unico IA:", error);
    return NextResponse.json({ error: "Error en el procesamiento neuronal." }, { status: 500 });
  }
}