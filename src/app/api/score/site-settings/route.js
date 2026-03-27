export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";
import { getMyRoleForOrg, isUuid } from "@/lib/dbScope";

const DEFAULT_SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

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

const getOrigin = (req) =>
  req.headers.get("origin") ||
  req.headers.get("Origin") ||
  "*";

const getDefaults = () => ({
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
    email: process.env.SUPPORT_EMAIL || process.env.FACTORY_EMAIL || "ventas.unicotextil@gmail.com",
    phone: process.env.SUPPORT_PHONE || "6642368701",
    whatsapp_e164: process.env.SUPPORT_WHATSAPP_E164 || "5216642368701",
    whatsapp_display: process.env.SUPPORT_WHATSAPP_DISPLAY || "664 236 8701",
  },
  updated_at: null,
});

const resolveOrgId = async (sb, explicitOrgId = "") => {
  const envId = explicitOrgId || process.env.SCORE_ORG_ID || process.env.DEFAULT_ORG_ID;
  if (envId && isUuid(envId)) return String(envId).trim();

  let orgId = DEFAULT_SCORE_ORG_ID;

  try {
    const { data: byId } = await sb
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .limit(1)
      .maybeSingle();

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

const shapeSiteSettings = (row) => {
  const d = getDefaults();

  if (!row || typeof row !== "object") return d;

  const theme = row.theme && typeof row.theme === "object" ? row.theme : {};
  const home = row.home && typeof row.home === "object" ? row.home : {};
  const socials = row.socials && typeof row.socials === "object" ? row.socials : {};

  return {
    ...d,
    hero_title: safeStr(row.hero_title) || d.hero_title,
    hero_image: safeStr(row.hero_image) || d.hero_image,
    promo_active: !!row.promo_active,
    promo_text: safeStr(row.promo_text),
    pixel_id: safeStr(row.pixel_id),
    maintenance_mode: !!row.maintenance_mode,
    season_key: safeStr(row.season_key || "default"),
    theme: { ...d.theme, ...theme },
    home: { ...d.home, ...home },
    socials: { ...d.socials, ...socials },
    contact: {
      ...d.contact,
      email: safeStr(row.contact_email) || d.contact.email,
      phone: safeStr(row.contact_phone) || d.contact.phone,
      whatsapp_e164: safeStr(row.whatsapp_e164) || d.contact.whatsapp_e164,
      whatsapp_display: safeStr(row.whatsapp_display) || d.contact.whatsapp_display,
    },
    updated_at: row.updated_at || null,
  };
};

const fetchPublicSettings = async (sb, orgId) => {
  const { data, error } = await sb
    .from("site_settings")
    .select(`
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
    `)
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return shapeSiteSettings(null);
  return shapeSiteSettings(data);
};

export async function GET(req) {
  try {
    const origin = getOrigin(req);
    const sb = serverSupabase();
    const orgId = await resolveOrgId(sb, new URL(req.url).searchParams.get("org_id") || "");

    const data = await fetchPublicSettings(sb, orgId);
    return json({ ...data, ok: true, org_id: orgId }, 200);
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
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);

    if (authErr || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const explicitOrgId = safeStr(body?.org_id || body?.orgId).trim();
    const orgId = await resolveOrgId(sb, explicitOrgId);

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !["owner", "admin", "marketing"].includes(role)) {
      return json({ ok: false, error: "Permisos insuficientes" }, 403);
    }

    const payload = {
      org_id: orgId,
      organization_id: orgId,
    };

    if ("hero_title" in body) payload.hero_title = safeStr(body.hero_title);
    if ("hero_image" in body) payload.hero_image = safeStr(body.hero_image);
    if ("promo_active" in body) payload.promo_active = !!body.promo_active;
    if ("promo_text" in body) payload.promo_text = safeStr(body.promo_text);
    if ("pixel_id" in body) payload.pixel_id = safeStr(body.pixel_id);
    if ("maintenance_mode" in body) payload.maintenance_mode = !!body.maintenance_mode;
    if ("season_key" in body) payload.season_key = safeStr(body.season_key, "default");

    if ("theme" in body && body.theme && typeof body.theme === "object") payload.theme = body.theme;
    if ("home" in body && body.home && typeof body.home === "object") payload.home = body.home;
    if ("socials" in body && body.socials && typeof body.socials === "object") payload.socials = body.socials;
    if ("contact" in body && body.contact && typeof body.contact === "object") {
      const contact = body.contact;
      payload.contact_email = safeStr(contact.email);
      payload.contact_phone = safeStr(contact.phone);
      payload.whatsapp_e164 = safeStr(contact.whatsapp_e164);
      payload.whatsapp_display = safeStr(contact.whatsapp_display);
    }

    const { data, error } = await sb
      .from("site_settings")
      .upsert(payload, { onConflict: "org_id" })
      .select(`
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
      `)
      .maybeSingle();

    if (error) {
      return json({ ok: false, error: error.message || "No se pudo actualizar" }, 500);
    }

    return json({ ok: true, org_id: orgId, site_settings: shapeSiteSettings(data) }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}