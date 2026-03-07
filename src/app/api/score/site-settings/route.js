export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: noStoreHeaders });

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const normEmail = (s) => safeStr(s).trim().toLowerCase();

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeStr(v).trim()
  );
}

async function getMyRoleForOrg(sb, orgId, user) {
  const email = normEmail(user?.email);
  const uid = safeStr(user?.id);

  const q = await sb
    .from("admin_users")
    .select("role,is_active,organization_id,org_id,email,user_id")
    .eq("is_active", true)
    .or(`organization_id.eq.${orgId},org_id.eq.${orgId}`)
    .or(`email.ilike.${email},user_id.eq.${uid}`)
    .limit(20);

  if (!q.error && Array.isArray(q.data) && q.data.length) {
    const exact =
      q.data.find((r) => safeStr(r?.organization_id || r?.org_id) === safeStr(orgId)) || q.data[0];
    return safeStr(exact?.role).toLowerCase();
  }

  return null;
}

function canRead(role) {
  return ["owner", "admin", "marketing", "support", "operations"].includes(
    safeStr(role).toLowerCase()
  );
}

function canWrite(role) {
  return ["owner", "admin", "marketing"].includes(safeStr(role).toLowerCase());
}

function defaults() {
  return {
    organization_id: SCORE_ORG_ID,
    hero_title: "",
    hero_image: "",
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
      facebook: "",
      instagram: "",
      youtube: "",
      tiktok: "",
    },
    contact_email: "",
    contact_phone: "",
    whatsapp_e164: "",
    whatsapp_display: "",
    updated_at: null,
  };
}

async function readSiteSettings(sb, orgId) {
  const base = defaults();

  const first = await sb
    .from("site_settings")
    .select(`
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
      contact_email,
      contact_phone,
      whatsapp_e164,
      whatsapp_display,
      updated_at,
      created_at
    `)
    .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (first.error) {
    throw new Error(first.error.message || "No se pudo leer site_settings.");
  }

  const row = first.data || null;
  if (!row) return base;

  return {
    ...base,
    organization_id: safeStr(row.organization_id || row.org_id || orgId),
    hero_title: safeStr(row.hero_title),
    hero_image: safeStr(row.hero_image),
    promo_active: !!row.promo_active,
    promo_text: safeStr(row.promo_text),
    pixel_id: safeStr(row.pixel_id),
    maintenance_mode: !!row.maintenance_mode,
    season_key: safeStr(row.season_key || "default"),
    theme: row.theme && typeof row.theme === "object" ? row.theme : base.theme,
    home: row.home && typeof row.home === "object" ? row.home : base.home,
    socials: row.socials && typeof row.socials === "object" ? row.socials : base.socials,
    contact_email: safeStr(row.contact_email),
    contact_phone: safeStr(row.contact_phone),
    whatsapp_e164: safeStr(row.whatsapp_e164),
    whatsapp_display: safeStr(row.whatsapp_display),
    updated_at: row.updated_at || null,
  };
}

async function writeSiteSettings(sb, orgId, patch) {
  const cleanTheme = patch?.theme && typeof patch.theme === "object" ? patch.theme : {};
  const cleanHome = patch?.home && typeof patch.home === "object" ? patch.home : {};
  const cleanSocials = patch?.socials && typeof patch.socials === "object" ? patch.socials : {};

  const payload = {
    organization_id: orgId,
    hero_title: safeStr(patch?.hero_title),
    hero_image: safeStr(patch?.hero_image),
    promo_active: !!patch?.promo_active,
    promo_text: safeStr(patch?.promo_text),
    pixel_id: safeStr(patch?.pixel_id),
    maintenance_mode: !!patch?.maintenance_mode,
    season_key: safeStr(patch?.season_key || "default"),
    theme: cleanTheme,
    home: cleanHome,
    socials: cleanSocials,
    contact_email: safeStr(patch?.contact_email),
    contact_phone: safeStr(patch?.contact_phone),
    whatsapp_e164: safeStr(patch?.whatsapp_e164),
    whatsapp_display: safeStr(patch?.whatsapp_display),
    updated_at: new Date().toISOString(),
  };

  const q1 = await sb.from("site_settings").upsert(payload, { onConflict: "organization_id" });
  if (!q1.error) return true;

  const payloadOrgId = {
    ...payload,
    org_id: orgId,
  };

  const q2 = await sb.from("site_settings").upsert(payloadOrgId, { onConflict: "org_id" });
  if (!q2.error) return true;

  throw new Error(q2.error?.message || q1.error?.message || "No se pudo guardar site_settings.");
}

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error } = await requireUserFromToken(sb, token);

    if (error || !user) {
      return json({ ok: false, error: "No autorizado." }, 401);
    }

    const { searchParams } = new URL(req.url);
    const orgId = safeStr(searchParams.get("org_id") || SCORE_ORG_ID).trim();

    if (!isUuid(orgId)) {
      return json({ ok: false, error: "org_id inválido." }, 400);
    }

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !canRead(role)) {
      return json({ ok: false, error: "Sin permisos." }, 403);
    }

    const data = await readSiteSettings(sb, orgId);

    return json({
      ok: true,
      role,
      data,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error } = await requireUserFromToken(sb, token);

    if (error || !user) {
      return json({ ok: false, error: "No autorizado." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orgId = safeStr(body?.organization_id || body?.org_id || SCORE_ORG_ID).trim();

    if (!isUuid(orgId)) {
      return json({ ok: false, error: "org_id inválido." }, 400);
    }

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !canWrite(role)) {
      return json({ ok: false, error: "Sin permisos para guardar." }, 403);
    }

    await writeSiteSettings(sb, orgId, body || {});
    const data = await readSiteSettings(sb, orgId);

    return json({
      ok: true,
      saved: true,
      data,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
