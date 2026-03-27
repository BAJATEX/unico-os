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

const shapeSettings = (row) => {
  const theme = row?.theme && typeof row.theme === "object" ? row.theme : {};
  const home = row?.home && typeof row.home === "object" ? row.home : {};
  const socials = row?.socials && typeof row.socials === "object" ? row.socials : {};

  return {
    ok: true,
    store: { name: "SCORE STORE", currency: "MXN", locale: "es-MX" },
    hero_title: safeStr(row?.hero_title) || null,
    hero_image: safeStr(row?.hero_image) || null,
    promo_active: !!row?.promo_active,
    promo_text: safeStr(row?.promo_text),
    pixel_id: safeStr(row?.pixel_id),
    maintenance_mode: !!row?.maintenance_mode,
    season_key: safeStr(row?.season_key || "default"),
    theme: {
      accent: "#e10600",
      accent2: "#111111",
      particles: true,
      ...theme,
    },
    home: {
      footer_note: "",
      shipping_note: "",
      returns_note: "",
      support_hours: "",
      ...home,
    },
    socials: {
      facebook: process.env.SOCIAL_FACEBOOK || "https://www.facebook.com/uniforme.unico/",
      instagram: process.env.SOCIAL_INSTAGRAM || "https://www.instagram.com/uniformes.unico",
      youtube: process.env.SOCIAL_YOUTUBE || "https://youtu.be/F4lw1EcehIA?si=jFBT9skFLs566g8N",
      tiktok: process.env.SOCIAL_TIKTOK || "",
      ...socials,
    },
    contact: {
      email:
        safeStr(row?.contact_email) ||
        process.env.SUPPORT_EMAIL ||
        process.env.FACTORY_EMAIL ||
        "ventas.unicotextil@gmail.com",
      phone: safeStr(row?.contact_phone) || process.env.SUPPORT_PHONE || "6642368701",
      whatsapp_e164: safeStr(row?.whatsapp_e164) || process.env.SUPPORT_WHATSAPP_E164 || "5216642368701",
      whatsapp_display:
        safeStr(row?.whatsapp_display) || process.env.SUPPORT_WHATSAPP_DISPLAY || "664 236 8701",
    },
    updated_at: row?.updated_at || null,
  };
};

export async function GET(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);

    if (authErr || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const explicitOrgId = safeStr(url.searchParams.get("org_id") || url.searchParams.get("orgId")).trim();
    const orgId = await resolveOrgId(sb, explicitOrgId);

    const role = await getMyRoleForOrg(sb, orgId, user);
    if (!role || !["owner", "admin", "marketing", "ops"].includes(role)) {
      return json({ ok: false, error: "Permisos insuficientes" }, 403);
    }

    const [settingsRes, productsRes, ordersRes, labelsRes, recentOrdersRes, recentProductsRes] =
      await Promise.all([
        sb
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
          .maybeSingle(),

        sb
          .from("products")
          .select("id", { count: "exact", head: true })
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`),

        sb
          .from("orders")
          .select("id", { count: "exact", head: true })
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`),

        sb
          .from("shipping_labels")
          .select("id", { count: "exact", head: true })
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`),

        sb
          .from("orders")
          .select("id, customer_name, customer_email, status, payment_status, shipping_mode, total_cents, amount_total_cents, amount_total_mxn, created_at")
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
          .order("created_at", { ascending: false })
          .limit(8),

        sb
          .from("products")
          .select("id, sku, name, price_cents, section_id, rank, created_at")
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
          .order("rank", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    const settings = shapeSettings(settingsRes?.data || null);

    return json({
      ok: true,
      org_id: orgId,
      role,
      user: {
        id: user.id,
        email: user.email || null,
      },
      site_settings: settings,
      counts: {
        products: productsRes?.count || 0,
        orders: ordersRes?.count || 0,
        shipping_labels: labelsRes?.count || 0,
        recent_orders: Array.isArray(recentOrdersRes?.data) ? recentOrdersRes.data.length : 0,
        recent_products: Array.isArray(recentProductsRes?.data) ? recentProductsRes.data.length : 0,
      },
      recent_orders: Array.isArray(recentOrdersRes?.data) ? recentOrdersRes.data : [],
      recent_products: Array.isArray(recentProductsRes?.data) ? recentProductsRes.data : [],
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}