"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  RefreshCcw,
  Save,
  UploadCloud,
  Image as ImageIcon,
  HelpCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";

const SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

const money = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(
    Number.isFinite(Number(v)) ? Number(v) : 0
  );

function HelpTip({ title, text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
        aria-label="Ayuda"
        title="Ayuda"
      >
        <HelpCircle size={16} />
      </button>
      {open ? (
        <div className="absolute z-[9999] top-10 right-0 w-[320px] max-w-[85vw]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl p-4">
            <p className="text-xs font-black text-slate-900">{title}</p>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed mt-1">{text}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 px-3 py-2 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

async function uploadToBucket(file, path) {
  const bucket = "scorestore-assets";
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

export default function ScoreStoreSettingsPage() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [orgId] = useState(SCORE_ORG_ID);

  const [season, setSeason] = useState("default");
  const [theme, setTheme] = useState({
    accent: "#e10600",
    accent2: "#111827",
    vfx_level: 0.8,
    particles: true,
    bg_glow: true,
    hero_bg_url: "",
    logo_url: "",
    season_badge_url: "",
  });

  const [copy, setCopy] = useState({
    hero_title: "",
    hero_subtitle: "",
    cta_primary: "Explorar Colecciones",
    cta_secondary: "Abrir Carrito",
    section_categories: "Colecciones",
    section_catalog: "Catálogo",
  });

  const [promo_active, setPromoActive] = useState(false);
  const [promo_text, setPromoText] = useState("");
  const [pixel_id, setPixelId] = useState("");

  const [status, setStatus] = useState({ ok: true, text: "" });

  useEffect(() => {
    const boot = async () => {
      if (!SUPABASE_CONFIGURED) {
        setStatus({ ok: false, text: "Falta Supabase (.env) en UnicOs." });
        setReady(true);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      setUser(sess?.session?.user || null);
      setReady(true);
    };
    boot().catch(() => setReady(true));
  }, []);

  const load = async () => {
    if (!orgId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("season_key,theme,copy,promo_active,promo_text,pixel_id,updated_at")
        .eq("organization_id", orgId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSeason(data.season_key || "default");
        setTheme((p) => ({ ...p, ...(data.theme || {}) }));
        setCopy((p) => ({ ...p, ...(data.copy || {}) }));
        setPromoActive(!!data.promo_active);
        setPromoText(data.promo_text || "");
        setPixelId(data.pixel_id || "");
      }

      setStatus({ ok: true, text: "Listo." });
    } catch (e) {
      setStatus({ ok: false, text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        season_key: season,
        theme,
        copy,
        promo_active: !!promo_active,
        promo_text: String(promo_text || ""),
        pixel_id: String(pixel_id || ""),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("site_settings").upsert(payload, {
        onConflict: "organization_id",
      });

      if (error) throw error;

      setStatus({ ok: true, text: "Guardado. Score Store se actualizará en segundos." });
    } catch (e) {
      setStatus({ ok: false, text: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (kind, file) => {
    if (!file) return;
    setSaving(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `site/${orgId}/${kind}_${Date.now()}_${safeName}`;
      const url = await uploadToBucket(file, path);

      setTheme((p) => ({
        ...p,
        ...(kind === "hero_bg" ? { hero_bg_url: url } : {}),
        ...(kind === "logo" ? { logo_url: url } : {}),
        ...(kind === "badge" ? { season_badge_url: url } : {}),
      }));

      setStatus({ ok: true, text: "Imagen subida. Solo falta guardar." });
    } catch (e) {
      setStatus({ ok: false, text: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <div className="p-6">Cargando…</div>;

  if (!SUPABASE_CONFIGURED)
    return <div className="p-6 font-black text-rose-700">Falta Supabase en .env</div>;

  if (!user)
    return <div className="p-6 font-black text-slate-800">Inicia sesión para editar Site Settings.</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-[50] bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="w-10 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
              aria-label="Volver"
              title="Volver"
            >
              <ArrowLeft size={18} />
            </a>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Score Store</p>
              <h1 className="text-lg font-black text-slate-900">Site Settings (Control Total)</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
              disabled={busy}
            >
              <RefreshCcw size={16} className={busy ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              onClick={save}
              className={clsx(
                "px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-2",
                saving ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
              )}
              disabled={saving}
            >
              <Save size={16} />
              Guardar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* status */}
        <div
          className={clsx(
            "rounded-2xl border p-4 font-black text-sm",
            status.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          {status.text || "—"}
        </div>

        {/* Season */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Temporada</p>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Tema por temporada <Sparkles size={18} className="text-sky-600" />
              </h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Cambia look & VFX suaves sin romper estructura.
              </p>
            </div>

            <HelpTip
              title="Temporadas"
              text="Ejemplo: 'Navidad' agrega glow y detalles festivos suaves. No cambia el layout, solo tema visual y pequeños efectos."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div>
              <label className="text-xs font-black text-slate-700">Season Key</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              >
                <option value="default">Default</option>
                <option value="navidad">Navidad</option>
                <option value="halloween">Halloween</option>
                <option value="verano">Verano</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Accent (color principal)</label>
              <input
                value={theme.accent}
                onChange={(e) => setTheme((p) => ({ ...p, accent: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">VFX Level (0 a 1)</label>
              <input
                value={String(theme.vfx_level)}
                onChange={(e) => setTheme((p) => ({ ...p, vfx_level: Number(e.target.value) }))}
                inputMode="decimal"
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-black text-slate-800">
              <input
                type="checkbox"
                checked={!!theme.particles}
                onChange={(e) => setTheme((p) => ({ ...p, particles: e.target.checked }))}
              />
              Partículas (suaves)
            </label>

            <label className="flex items-center gap-2 text-sm font-black text-slate-800">
              <input
                type="checkbox"
                checked={!!theme.bg_glow}
                onChange={(e) => setTheme((p) => ({ ...p, bg_glow: e.target.checked }))}
              />
              Glow de fondo
            </label>
          </div>
        </section>

        {/* Uploads */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Imágenes</p>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Assets del tema <ImageIcon size={18} className="text-slate-700" />
              </h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Subes aquí y luego guardas. Score Store lo usa directo.
              </p>
            </div>

            <HelpTip
              title="Assets"
              text="Se suben a Supabase Storage (bucket scorestore-assets). Luego se guardan en site_settings para que Score Store los pinte."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-700 mb-2">Hero Background</p>
              <input type="file" accept="image/*" onChange={(e) => onUpload("hero_bg", e.target.files?.[0])} />
              <p className="text-[11px] font-semibold text-slate-500 mt-2 break-all">{theme.hero_bg_url || "—"}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-700 mb-2">Logo (opcional)</p>
              <input type="file" accept="image/*" onChange={(e) => onUpload("logo", e.target.files?.[0])} />
              <p className="text-[11px] font-semibold text-slate-500 mt-2 break-all">{theme.logo_url || "—"}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-700 mb-2">Season Badge (opcional)</p>
              <input type="file" accept="image/*" onChange={(e) => onUpload("badge", e.target.files?.[0])} />
              <p className="text-[11px] font-semibold text-slate-500 mt-2 break-all">{theme.season_badge_url || "—"}</p>
            </div>
          </div>
        </section>

        {/* Copy */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Textos</p>
              <h2 className="text-lg font-black text-slate-900">Copys editables</h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Cambia títulos y botones sin tocar código.
              </p>
            </div>
            <HelpTip title="Copys" text="Al guardar, Score Store los descarga y reemplaza en pantalla automáticamente." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="text-xs font-black text-slate-700">Hero Title (opcional)</label>
              <input
                value={copy.hero_title}
                onChange={(e) => setCopy((p) => ({ ...p, hero_title: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Hero Subtitle</label>
              <input
                value={copy.hero_subtitle}
                onChange={(e) => setCopy((p) => ({ ...p, hero_subtitle: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">CTA Primary</label>
              <input
                value={copy.cta_primary}
                onChange={(e) => setCopy((p) => ({ ...p, cta_primary: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">CTA Secondary</label>
              <input
                value={copy.cta_secondary}
                onChange={(e) => setCopy((p) => ({ ...p, cta_secondary: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Título Colecciones</label>
              <input
                value={copy.section_categories}
                onChange={(e) => setCopy((p) => ({ ...p, section_categories: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Título Catálogo</label>
              <input
                value={copy.section_catalog}
                onChange={(e) => setCopy((p) => ({ ...p, section_catalog: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>
          </div>
        </section>

        {/* Promo + Pixel */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Marketing</p>
              <h2 className="text-lg font-black text-slate-900">Promo Bar + Pixel</h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Avisos rápidos arriba y Meta Pixel (si el cliente acepta cookies).
              </p>
            </div>
            <HelpTip
              title="Promo + Pixel"
              text="Promo bar sirve para anuncios. El Pixel se activa solo con consentimiento (cookies)."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <label className="flex items-center gap-2 text-sm font-black text-slate-800">
              <input type="checkbox" checked={promo_active} onChange={(e) => setPromoActive(e.target.checked)} />
              Promo activa
            </label>

            <div>
              <label className="text-xs font-black text-slate-700">Texto promo</label>
              <input
                value={promo_text}
                onChange={(e) => setPromoText(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black text-slate-700">Meta Pixel ID</label>
              <input
                value={pixel_id}
                onChange={(e) => setPixelId(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}