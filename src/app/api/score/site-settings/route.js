// src/app/api/score/site-settings/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid, normEmail } from "@/lib/dbScope";
import { hasPerm } from "@/lib/authz";
import { writeAudit } from "@/lib/auditServer";

const DEFAULT_SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const safeBool = (v, d = false) => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return d;
};

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.*)$/i);
  return m ? m[1] : "";
}

function cleanJsonObject(v, fallback = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fallback;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return fallback;
  }
}

function getDefaults() {
  return {
    ok: true,
    store: { name: "SCORE STORE", currency: "MXN", locale: "es-MX" },
    hero_title: null,
    hero_image: null,
    promo_active: false,
    promo_text: "",
    pixel_id: "",
    maintenance_mode: false,
    season_key: "default",
    theme: {
      accent: "#e10600",
      accent2: "#111111",
      particles: true,
    },
    home: {
      footer_note: "",
      shipping_note: "",
      returns_note: "",
      support_hours: "",
    },
    socials: {
      facebook: process.env.SOCIAL_FACEBOOK || "https://www.facebook.com/uniforme.unico/",
      instagram: process.env.SOCIAL_INSTAGRAM || "https://www.instagram.com/uniformes.unico",
      youtube: process.env.SOCIAL_YOUTUBE || "https://youtu.be/F4lw1EcehIA?si=jFBT9skFLs566g8N",
      tiktok: process.env.SOCIAL_TIKTOK || "",
    },
    contact: {
      email:
        process.env.SUPPORT_EMAIL ||
        process.env.FACTORY_EMAIL ||
        "ventas.unicotextil@gmail.com",
      phone: process.env.SUPPORT_PHONE || "6642368701",
      whatsapp_e164: process.env.SUPPORT_WHATSAPP_E164 || "5216642368701",
      whatsapp_display: process.env.SUPPORT_WHATSAPP_DISPLAY || "664 236 8701",
    },
    updated_at: null,
  };
}

function resolveOrgIdCandidates(url, body) {
  const candidates = [
    safeStr(body?.org_id || body?.orgId || body?.organization_id || "").trim(),
    safeStr(url.searchParams.get("org_id") || url.searchParams.get("orgId") || "").trim(),
    safeStr(process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID || "").trim(),
  ].filter(Boolean);

  return candidates;
}

async function resolveOrgId(sb, url, body = {}) {
  for (const candidate of resolveOrgIdCandidates(url, body)) {
    if (isUuid(candidate)) return candidate;
  }

  try {
    const { data: bySlug } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", "score-store")
      .limit(1)
      .maybeSingle();

    if (bySlug?.id && isUuid(bySlug.id)) return bySlug.id;

    const { data: byName } = await sb
      .from("organizations")
      .select("id")
      .ilike("name", "%score%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName?.id && isUuid(byName.id)) return byName.id;

    const { data: anyOrg } = await sb
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (anyOrg?.id && isUuid(anyOrg.id)) return anyOrg.id;
  } catch {}

  return DEFAULT_SCORE_ORG_ID;
}

function shapeSettings(row) {
  const d = getDefaults();
  const theme = cleanJsonObject(row?.theme, {});
  const home = cleanJsonObject(row?.home, {});
  const socials = cleanJsonObject(row?.socials, {});

  return {
    ok: true,
    store: { ...d.store },
    hero_title: safeStr(row?.hero_title) || null,
    hero_image: safeStr(row?.hero_image) || null,
    promo_active: safeBool(row?.promo_active, false),
    promo_text: safeStr(row?.promo_text),
    pixel_id: safeStr(row?.pixel_id),
    maintenance_mode: safeBool(row?.maintenance_mode, false),
    season_key: safeStr(row?.season_key || "default"),
    theme: {
      ...d.theme,
      ...theme,
    },
    home: {
      ...d.home,
      ...home,
    },
    socials: {
      ...d.socials,
      ...socials,
    },
    contact: {
      ...d.contact,
      email: safeStr(row?.contact_email) || d.contact.email,
      phone: safeStr(row?.contact_phone) || d.contact.phone,
      whatsapp_e164: safeStr(row?.whatsapp_e164) || d.contact.whatsapp_e164,
      whatsapp_display: safeStr(row?.whatsapp_display) || d.contact.whatsapp_display,
    },
    updated_at: row?.updated_at || null,
  };
}

function normalizePatch(body = {}) {
  const patch = {};

  const directTextFields = [
    "hero_title",
    "hero_image",
    "promo_text",
    "pixel_id",
    "season_key",
    "contact_email",
    "contact_phone",
    "whatsapp_e164",
    "whatsapp_display",
  ];

  for (const key of directTextFields) {
    if (key in body) patch[key] = safeStr(body[key]).trim();
  }

  const boolFields = ["promo_active", "maintenance_mode"];
  for (const key of boolFields) {
    if (key in body) patch[key] = safeBool(body[key]);
  }

  if ("theme" in body) patch.theme = cleanJsonObject(body.theme, {});
  if ("home" in body) patch.home = cleanJsonObject(body.home, {});
  if ("socials" in body) patch.socials = cleanJsonObject(body.socials, {});

  if ("store" in body) patch.store = cleanJsonObject(body.store, {});

  return patch;
}

function mergeSettings(current, patch) {
  const d = getDefaults();
  const c = shapeSettings(current || null);

  return {
    ...c,
    hero_title: patch.hero_title !== undefined ? patch.hero_title : c.hero_title,
    hero_image: patch.hero_image !== undefined ? patch.hero_image : c.hero_image,
    promo_active: patch.promo_active !== undefined ? patch.promo_active : c.promo_active,
    promo_text: patch.promo_text !== undefined ? patch.promo_text : c.promo_text,
    pixel_id: patch.pixel_id !== undefined ? patch.pixel_id : c.pixel_id,
    maintenance_mode:
      patch.maintenance_mode !== undefined ? patch.maintenance_mode : c.maintenance_mode,
    season_key: patch.season_key !== undefined ? patch.season_key || "default" : c.season_key,
    theme: {
      ...d.theme,
      ...c.theme,
      ...(patch.theme || {}),
    },
    home: {
      ...d.home,
      ...c.home,
      ...(patch.home || {}),
    },
    socials: {
      ...d.socials,
      ...c.socials,
      ...(patch.socials || {}),
    },
    contact: {
      ...d.contact,
      ...c.contact,
      email: patch.contact_email !== undefined ? patch.contact_email || d.contact.email : c.contact.email,
      phone: patch.contact_phone !== undefined ? patch.contact_phone || d.contact.phone : c.contact.phone,
      whatsapp_e164:
        patch.whatsapp_e164 !== undefined ? patch.whatsapp_e164 || d.contact.whatsapp_e164 : c.contact.whatsapp_e164,
      whatsapp_display:
        patch.whatsapp_display !== undefined
          ? patch.whatsapp_display || d.contact.whatsapp_display
          : c.contact.whatsapp_display,
    },
  };
}

function buildRowPayload(orgId, merged) {
  return {
    organization_id: orgId,
    org_id: orgId,
    hero_title: merged.hero_title || null,
    hero_image: merged.hero_image || null,
    promo_active: !!merged.promo_active,
    promo_text: merged.promo_text || "",
    pixel_id: merged.pixel_id || "",
    maintenance_mode: !!merged.maintenance_mode,
    season_key: merged.season_key || "default",
    theme: cleanJsonObject(merged.theme, {}),
    home: cleanJsonObject(merged.home, {}),
    socials: cleanJsonObject(merged.socials, {}),
    contact_email: merged.contact?.email || null,
    contact_phone: merged.contact?.phone || null,
    whatsapp_e164: merged.contact?.whatsapp_e164 || null,
    whatsapp_display: merged.contact?.whatsapp_display || null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchPublicSettings(sb, orgId) {
  const { data, error } = await sb
    .from("site_settings")
    .select(
      `
      organization_id,
      org_id,
      hero_title,
      hero_image,
      promo_active,
      promo_text,
      pixel_id,
      maintenance_mode,
      season_key,
      theme,
      home,
      socials,
      updated_at,
      contact_email,
      contact_phone,
      whatsapp_e164,
      whatsapp_display
    `
    )
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return shapeSettings(null);
  return shapeSettings(data);
}

async function authorizeWrite(req, sb, orgId) {
  const token = getBearerToken(req);
  const { user, error: authErr } = await requireUserFromToken(sb, token);

  if (authErr || !user) {
    return { ok: false, res: json({ ok: false, error: "Unauthorized" }, 401) };
  }

  const role = await getMyRoleForOrg(sb, orgId, user);
  if (!role || !hasPerm(role, "settings")) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  if (!["owner", "admin", "marketing"].includes(String(role).toLowerCase())) {
    return { ok: false, res: json({ ok: false, error: "Permisos insuficientes" }, 403) };
  }

  return { ok: true, user, role };
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const url = new URL(req.url);
    const orgId = await resolveOrgId(sb, url, {});

    const settings = await fetchPublicSettings(sb, orgId);
    return json({ ...settings, ok: true, org_id: orgId }, 200);
  } catch (error) {
    return json(
      {
        ok: false,
        error: String(error?.message || error || "No se pudieron cargar los ajustes"),
      },
      500
    );
  }
}

export async function PATCH(req) {
  try {
    const sb = serverSupabase();
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const orgId = await resolveOrgId(sb, url, body);

    const auth = await authorizeWrite(req, sb, orgId);
    if (!auth.ok) return auth.res;

    const current = await fetchPublicSettings(sb, orgId);
    const patch = normalizePatch(body);

    if (!Object.keys(patch).length) {
      return json({ ok: false, error: "No hay campos válidos para actualizar" }, 400);
    }

    const merged = mergeSettings(current, patch);
    const payload = buildRowPayload(orgId, merged);

    const { data, error } = await sb
      .from("site_settings")
      .upsert(payload, { onConflict: "organization_id" })
      .select(
        `
        organization_id,
        org_id,
        hero_title,
        hero_image,
        promo_active,
        promo_text,
        pixel_id,
        maintenance_mode,
        season_key,
        theme,
        home,
        socials,
        updated_at,
        contact_email,
        contact_phone,
        whatsapp_e164,
        whatsapp_display
      `
      )
      .maybeSingle();

    if (error) {
      return json(
        { ok: false, error: error.message || "No se pudieron guardar los ajustes" },
        500
      );
    }

    await writeAudit(sb, {
      organization_id: orgId,
      actor_email: normEmail(auth.user?.email),
      actor_user_id: auth.user?.id || null,
      action: "site_settings.update",
      entity: "site_settings",
      entity_id: orgId,
      summary: "Public site settings updated",
      before: current,
      after: data ? shapeSettings(data) : merged,
      meta: {
        role: auth.role,
        patch_keys: Object.keys(patch),
        source: "api/score/site-settings",
      },
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return json({
      ok: true,
      org_id: orgId,
      role: auth.role,
      site_settings: data ? shapeSettings(data) : merged,
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}