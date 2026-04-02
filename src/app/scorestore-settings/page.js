// src/app/scorestore-settings/page.js
"use client";

import { useEffect, useMemo, useState } from "react";

const SCORESTORE_URL =
  process.env.NEXT_PUBLIC_SCORESTORE_URL || "https://scorestore.vercel.app";

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const safeBool = (v, d = false) => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return d;
};

const deepClone = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
};

const getInitialForm = (settings) => ({
  org_id: safeStr(settings?.org_id || ""),
  hero_title: safeStr(settings?.hero_title || ""),
  hero_image: safeStr(settings?.hero_image || ""),
  promo_active: safeBool(settings?.promo_active, false),
  promo_text: safeStr(settings?.promo_text || ""),
  pixel_id: safeStr(settings?.pixel_id || ""),
  maintenance_mode: safeBool(settings?.maintenance_mode, false),
  season_key: safeStr(settings?.season_key || "default"),
  theme: {
    accent: safeStr(settings?.theme?.accent || "#e10600"),
    accent2: safeStr(settings?.theme?.accent2 || "#111111"),
    particles: safeBool(settings?.theme?.particles, true),
  },
  home: {
    footer_note: safeStr(settings?.home?.footer_note || ""),
    shipping_note: safeStr(settings?.home?.shipping_note || ""),
    returns_note: safeStr(settings?.home?.returns_note || ""),
    support_hours: safeStr(settings?.home?.support_hours || ""),
  },
  socials: {
    facebook: safeStr(settings?.socials?.facebook || ""),
    instagram: safeStr(settings?.socials?.instagram || ""),
    youtube: safeStr(settings?.socials?.youtube || ""),
    tiktok: safeStr(settings?.socials?.tiktok || ""),
  },
  contact: {
    email: safeStr(settings?.contact?.email || ""),
    phone: safeStr(settings?.contact?.phone || ""),
    whatsapp_e164: safeStr(settings?.contact?.whatsapp_e164 || ""),
    whatsapp_display: safeStr(settings?.contact?.whatsapp_display || ""),
  },
});

export default function ScorestoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(getInitialForm(null));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("unicos_token") || "";
  }, []);

  const apiHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setSuccess("Copiado al portapapeles.");
      window.setTimeout(() => setSuccess(""), 1500);
    } catch {
      setError("No se pudo copiar.");
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/score/site-settings", {
        method: "GET",
        headers: apiHeaders,
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudieron cargar los ajustes");
      }

      setSettings(data);
      setForm(getInitialForm(data));
    } catch (e) {
      setError(String(e?.message || e || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (section, key, value) => {
    setForm((prev) => {
      const next = deepClone(prev);
      if (section) {
        next[section] = next[section] || {};
        next[section][key] = value;
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        org_id: form.org_id || settings?.org_id || "",
        hero_title: safeStr(form.hero_title),
        hero_image: safeStr(form.hero_image),
        promo_active: !!form.promo_active,
        promo_text: safeStr(form.promo_text),
        pixel_id: safeStr(form.pixel_id),
        maintenance_mode: !!form.maintenance_mode,
        season_key: safeStr(form.season_key || "default"),
        theme: {
          accent: safeStr(form.theme?.accent || "#e10600"),
          accent2: safeStr(form.theme?.accent2 || "#111111"),
          particles: !!form.theme?.particles,
        },
        home: {
          footer_note: safeStr(form.home?.footer_note || ""),
          shipping_note: safeStr(form.home?.shipping_note || ""),
          returns_note: safeStr(form.home?.returns_note || ""),
          support_hours: safeStr(form.home?.support_hours || ""),
        },
        socials: {
          facebook: safeStr(form.socials?.facebook || ""),
          instagram: safeStr(form.socials?.instagram || ""),
          youtube: safeStr(form.socials?.youtube || ""),
          tiktok: safeStr(form.socials?.tiktok || ""),
        },
        contact: {
          email: safeStr(form.contact?.email || ""),
          phone: safeStr(form.contact?.phone || ""),
          whatsapp_e164: safeStr(form.contact?.whatsapp_e164 || ""),
          whatsapp_display: safeStr(form.contact?.whatsapp_display || ""),
        },
      };

      const res = await fetch("/api/score/site-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudieron guardar los ajustes");
      }

      setSettings(data.site_settings || data);
      setForm(getInitialForm(data.site_settings || data));
      setSuccess("Ajustes guardados correctamente.");
    } catch (e) {
      setError(String(e?.message || e || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const field = (label, value, onChange, placeholder = "") => (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:bg-white/8"
      />
    </label>
  );

  const textarea = (label, value, onChange, placeholder = "", rows = 4) => (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:bg-white/8"
      />
    </label>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(225,6,0,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_35%)]" />
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-white/70">
                Score Store Settings
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Centro de configuración conectado
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Ajustes públicos del ecosistema Score Store alineados con el admin, el frontend y la tienda.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <a
                href={SCORESTORE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Abrir Score Store
              </a>
              <button
                type="button"
                onClick={() => copyText(SCORESTORE_URL)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Copiar URL pública
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                URL pública
              </div>
              <div className="mt-2 break-all text-sm font-bold text-white">{SCORESTORE_URL}</div>
              <div className="mt-4 text-xs text-white/50">
                Fuente de navegación para la tienda oficial.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Estado
              </div>

              {loading ? (
                <p className="mt-3 text-sm text-white/70">Cargando ajustes…</p>
              ) : error ? (
                <p className="mt-3 text-sm font-semibold text-red-300">{error}</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/5 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                      Promo activa
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {settings?.promo_active ? "Sí" : "No"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                      Última actualización
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {safeStr(settings?.updated_at, "—")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4 sm:col-span-2">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                      Texto promo
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {safeStr(settings?.promo_text, "Sin texto activo")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Editor rápido
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {field("Org ID", form.org_id, (v) => updateField(null, "org_id", v), "UUID de la organización")}
                {field("Hero title", form.hero_title, (v) => updateField(null, "hero_title", v), "Título principal")}
                {field("Hero image", form.hero_image, (v) => updateField(null, "hero_image", v), "URL de imagen")}
                {field("Pixel ID", form.pixel_id, (v) => updateField(null, "pixel_id", v), "Meta / Pixel")}
                {field("Season key", form.season_key, (v) => updateField(null, "season_key", v), "default")}
                {field("Contact email", form.contact.email, (v) => updateField("contact", "email", v), "correo")}
                {field("Contact phone", form.contact.phone, (v) => updateField("contact", "phone", v), "teléfono")}
                {field("WhatsApp E164", form.contact.whatsapp_e164, (v) => updateField("contact", "whatsapp_e164", v), "521...")}
                {field("WhatsApp display", form.contact.whatsapp_display, (v) => updateField("contact", "whatsapp_display", v), "664 236 8701")}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.promo_active}
                    onChange={(e) => updateField(null, "promo_active", e.target.checked)}
                  />
                  Promo activa
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.maintenance_mode}
                    onChange={(e) => updateField(null, "maintenance_mode", e.target.checked)}
                  />
                  Modo mantenimiento
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.theme.particles}
                    onChange={(e) => updateField("theme", "particles", e.target.checked)}
                  />
                  Efectos / partículas
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {field("Accent", form.theme.accent, (v) => updateField("theme", "accent", v), "#e10600")}
                {field("Accent 2", form.theme.accent2, (v) => updateField("theme", "accent2", v), "#111111")}
              </div>

              <div className="mt-4 grid gap-4">
                {textarea("Promo text", form.promo_text, (v) => updateField(null, "promo_text", v), "Texto promocional", 3)}
                {textarea("Footer note", form.home.footer_note, (v) => updateField("home", "footer_note", v), "Nota de pie de página", 3)}
                {textarea("Shipping note", form.home.shipping_note, (v) => updateField("home", "shipping_note", v), "Nota de envíos", 3)}
                {textarea("Returns note", form.home.returns_note, (v) => updateField("home", "returns_note", v), "Nota de devoluciones", 3)}
                {textarea("Support hours", form.home.support_hours, (v) => updateField("home", "support_hours", v), "Horario de soporte", 3)}
              </div>

              <div className="mt-4 grid gap-4">
                {field("Facebook", form.socials.facebook, (v) => updateField("socials", "facebook", v), "URL Facebook")}
                {field("Instagram", form.socials.instagram, (v) => updateField("socials", "instagram", v), "URL Instagram")}
                {field("YouTube", form.socials.youtube, (v) => updateField("socials", "youtube", v), "URL YouTube")}
                {field("TikTok", form.socials.tiktok, (v) => updateField("socials", "tiktok", v), "URL TikTok")}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || loading}
                  className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar ajustes"}
                </button>

                <button
                  type="button"
                  onClick={load}
                  disabled={saving || loading}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Recargar
                </button>
              </div>

              {success ? (
                <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {success}
                </p>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Vista previa de datos
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">
                    Hero
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {safeStr(form.hero_title, "Sin título")}
                  </p>
                  <p className="mt-2 text-xs text-white/60 break-all">
                    {safeStr(form.hero_image, "Sin imagen")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">
                    Contacto
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {safeStr(form.contact.email, "—")}
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    {safeStr(form.contact.phone, "—")} · {safeStr(form.contact.whatsapp_display, "—")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">
                    Socials
                  </p>
                  <p className="mt-2 break-all text-sm text-white/75">
                    {safeStr(form.socials.facebook, "Facebook vacío")}
                  </p>
                  <p className="mt-1 break-all text-sm text-white/75">
                    {safeStr(form.socials.instagram, "Instagram vacío")}
                  </p>
                  <p className="mt-1 break-all text-sm text-white/75">
                    {safeStr(form.socials.youtube, "YouTube vacío")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">
                    Flags
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                      {form.promo_active ? "Promo activa" : "Promo inactiva"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                      {form.maintenance_mode ? "Mantenimiento ON" : "Mantenimiento OFF"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                      {form.theme.particles ? "VFX ON" : "VFX OFF"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">
                    Último payload recibido
                  </p>
                  <pre className="mt-3 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-slate-200">
{JSON.stringify(
  {
    org_id: form.org_id || settings?.org_id || null,
    hero_title: form.hero_title,
    promo_active: form.promo_active,
    maintenance_mode: form.maintenance_mode,
    season_key: form.season_key,
  },
  null,
  2
)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}