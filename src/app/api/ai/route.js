export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid } from "@/lib/dbScope";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));

const getBearerToken = (req) => {
  const h = req.headers.get("authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.*)$/i);
  return m ? m[1] : "";
};

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

function resolveOrgIdFromEnv() {
  const envId = process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID || "";
  return isUuid(envId) ? envId.trim() : "";
}

async function callGemini(messages, context = {}) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemPrompt = [
    "Eres el asistente operativo de UnicOs / Score Store.",
    "Responde en español, claro, breve y accionable.",
    "Prioriza administración, ventas, catálogo, pedidos, soporte, automatización y Vercel.",
    "No inventes datos. Si faltan, indícalo.",
    context?.storeName ? `Tienda: ${context.storeName}` : "",
    context?.version ? `Versión: ${context.version}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const contents = [];

  if (systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: `INSTRUCCIONES:\n${systemPrompt}` }],
    });
  }

  for (const m of Array.isArray(messages) ? messages : []) {
    const role = m?.role === "assistant" ? "model" : "user";
    const text = safeStr(m?.content || m?.text || "");
    if (!text) continue;
    contents.push({ role, parts: [{ text }] });
  }

  const body = {
    contents,
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 800,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Gemini HTTP ${res.status}`);
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("\n")
      .trim() || "";

  if (!text) throw new Error("Respuesta vacía de Gemini");
  return text;
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);

    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const message = safeStr(payload?.message || payload?.input || payload?.prompt || "").trim();
    const context = payload?.context && typeof payload.context === "object" ? payload.context : {};

    if (!message) {
      return json({ ok: false, error: "Missing message" }, 400);
    }

    const orgId = safeStr(context?.org_id || context?.orgId || resolveOrgIdFromEnv()).trim();
    if (orgId && !isUuid(orgId)) {
      return json({ ok: false, error: "Invalid org_id" }, 400);
    }

    if (orgId) {
      const role = await getMyRoleForOrg(sb, orgId, user);
      if (!role || !["owner", "admin", "marketing", "ops"].includes(role)) {
        return json({ ok: false, error: "Permisos insuficientes" }, 403);
      }
    }

    const reply = await callGemini(
      [
        { role: "user", content: message },
      ],
      {
        storeName: "UnicOs / Score Store",
        version: context?.version || "",
      }
    );

    return json({
      ok: true,
      reply,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: normalizeGeminiError(error),
      },
      500
    );
  }
}