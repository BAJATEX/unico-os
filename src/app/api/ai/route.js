export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid } from "@/lib/dbScope";

const DEFAULT_SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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

const resolveOrgId = async (sb, explicitOrgId = "") => {
  const envId = explicitOrgId || process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID;
  if (envId && isUuid(envId)) return String(envId).trim();

  let orgId = DEFAULT_SCORE_ORG_ID;

  try {
    const { data: byId } = await sb.from("organizations").select("id").eq("id", orgId).limit(1).maybeSingle();
    if (byId?.id) return orgId;

    const { data: byName } = await sb
      .from("organizations")
      .select("id")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName?.id) orgId = byName.id;
  } catch {}

  return orgId;
};

const normalizeGeminiError = (e) => {
  const msg = String(e?.message || e || "");
  if (/model.*not found|404/i.test(msg)) {
    return "La inteligencia está usando un modelo no disponible. Revisa GEMINI_MODEL en Vercel.";
  }
  if (/api key|unauth|permission|denied|401|403/i.test(msg)) {
    return "La inteligencia no tiene permiso para responder en este momento.";
  }
  return "La inteligencia del panel no pudo completar la solicitud.";
};

async function authorize(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "Unauthorized" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !["owner", "admin", "marketing", "ops"].includes(role)) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

async function callGemini({ prompt, context = "", temperature = 0.4, maxOutputTokens = 800 }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurada");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Eres el asistente operativo de UnicOs / Score Store.",
              "Responde en español, con precisión, sin inventar datos.",
              context ? `Contexto:\n${context}` : "",
              `Solicitud:\n${prompt}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.4,
      maxOutputTokens: Math.max(64, Math.min(2048, Number(maxOutputTokens) || 800)),
      topP: 0.95,
      topK: 40,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || `Gemini HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("")
      .trim() || "";

  return {
    text,
    raw: data,
  };
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const body = await req.json().catch(() => ({}));
    const orgId = await resolveOrgId(sb, safeStr(body?.org_id || body?.orgId).trim());

    const auth = await authorize(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const prompt = safeStr(body?.prompt).trim();
    const context = safeStr(body?.context).trim();
    const temperature = body?.temperature ?? 0.4;
    const maxOutputTokens = body?.max_output_tokens ?? body?.maxOutputTokens ?? 800;

    if (!prompt) {
      return json({ ok: false, error: "Missing prompt" }, 400);
    }

    const result = await callGemini({
      prompt,
      context,
      temperature,
      maxOutputTokens,
    });

    return json({
      ok: true,
      org_id: orgId,
      model: GEMINI_MODEL,
      answer: result.text,
      raw: process.env.NODE_ENV === "production" ? undefined : result.raw,
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

export async function GET() {
  return json(
    {
      ok: true,
      model: GEMINI_MODEL,
      configured: Boolean(GEMINI_API_KEY),
    },
    200
  );
}