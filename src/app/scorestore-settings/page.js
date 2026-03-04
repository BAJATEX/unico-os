"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { RefreshCcw, Save, UploadCloud, Image as ImageIcon, HelpCircle, Sparkles, ArrowLeft, ExternalLink } from "lucide-react";

import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";

const SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

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
        <div className="absolute z-[9999] top-10 right-0 w-[340px] max-w-[85vw]">
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

  const orgId = useMemo(() => SCORE_ORG_ID, []);

  // “Temporada”: clave simple para activar tema/efectos
  const [season, setSeason] = useState("default");

  // Theme vive en site_settings.theme (jsonb)
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

  // Home vive en site_settings.home (jsonb)
  const [home, setHome] = useState({
    hero_title: "",
    hero_subtitle: "",
    cta_primary: "Explorar Colecciones",
    cta_secondary: "Abrir Carrito",
    section_categories: "Colecciones",
    section_catalog: "Catálogo",
  });

  // Socials vive en site_settings.socials (jsonb)
  const [socials, setSocials] = useState({
    facebook: "https://www.facebook.com/uniforme.unico/",
    instagram: "https://www.instagram.com/uniformes.unico",
    youtube: "https://youtu.be/F4lw1EcehIA?si=jFBT9skFLs566g8N",
  });

  // Otros campos “top-level”
  const [promo_active, setPromoActive] = useState(false);
  const [promo_text, setPromoText] = useState("");
  const [pixel_id, setPixelId] = useState("");
  const [contact_email, setContactEmail] = useState("ventas.unicotextil@gmail.com");
  const [maintenance_mode, setMaintenanceMode] = useState(false);

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
      // Nota: tu tabla real usa org_id (NOT NULL). organization_id existe en algunos esquemas legacy.
      const { data, error } = await supabase
        .from("site_settings")
        .select(
          "org_id, organization_id, season_key, theme, home, socials, promo_active, promo_text, pixel_id, hero_title, hero_image, contact_email, maintenance_mode, updated_at"
        )
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSeason(String(data.season_key || "default"));

        const t = data.theme || {};
        setTheme((p) => ({
          ...p,
          ...t,
          ...(data.hero_image ? { hero_bg_url: String(data.hero_image) } : {}),
        }));

        const h = data.home || {};
        setHome((p) => ({
          ...p,
          ...h,
          ...(data.hero_title ? { hero_title: String(data.hero_title) } : {}),
        }));

        setSocials((p) => ({ ...p, ...(data.socials || {}) }));

        setPromoActive(!!data.promo_active);
        setPromoText(String(data.promo_text || ""));
        setPixelId(String(data.pixel_id || ""));
        setContactEmail(String(data.contact_email || contact_email));
        setMaintenanceMode(!!data.maintenance_mode);
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
        org_id: orgId,
        organization_id: orgId, // compat legacy (no rompe si la columna existe)
        season_key: String(season || "default"),
        theme,
        home: { ...home },
        socials,
        promo_active: !!promo_active,
        promo_text: String(promo_text || ""),
        pixel_id: String(pixel_id || ""),
        hero_title: String(home.hero_title || ""),
        hero_image: String(theme.hero_bg_url || ""),
        contact_email: String(contact_email || ""),
        maintenance_mode: !!maintenance_mode,
        updated_at: new Date().toISOString(),
      };

      // Conflicto por org_id (tu tabla real usa org_id NOT NULL)
      const { error } = await supabase.from("site_settings").upsert(payload, { onConflict: "org_id" });
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
            <a
              href="https://scorestore.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
              title="Abrir Score Store"
            >
              <ExternalLink size={16} />
              Ver tienda
            </a>

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
        <div
          className={clsx(
            "rounded-2xl border p-4 font-semibold",
            status.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          {status.text || "—"}
        </div>

        {/* Temporada */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Sparkles size={14} className="text-sky-600" /> Temporada / Estilo
            <HelpTip
              title="Temporada"
              text="Cambia el estilo general sin romper la estructura. Ej: navidad / verano. Al guardar, Score Store ajusta efectos y tema."
            />
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className="text-xs font-black text-slate-700">Clave (ej: navidad)</label>
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                placeholder="default"
              />
              <p className="text-[11px] font-semibold text-slate-500 mt-1">No uses espacios. Ej: navidad</p>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Nivel de efectos (0 a 1)</label>
              <input
                value={String(theme.vfx_level ?? 0.8)}
                onChange={(e) => setTheme((p) => ({ ...p, vfx_level: Number(e.target.value) }))}
                inputMode="decimal"
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-black text-slate-800">
                <input
                  type="checkbox"
                  checked={!!theme.particles}
                  onChange={(e) => setTheme((p) => ({ ...p, particles: e.target.checked }))}
                  className="w-4 h-4"
                />
                Partículas
              </label>
              <label className="flex items-center gap-2 text-sm font-black text-slate-800">
                <input
                  type="checkbox"
                  checked={!!theme.bg_glow}
                  onChange={(e) => setTheme((p) => ({ ...p, bg_glow: e.target.checked }))}
                  className="w-4 h-4"
                />
                Glow
              </label>
            </div>
          </div>
        </section>

        {/* Copy Home */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Sparkles size={14} className="text-sky-600" /> Textos / Copy
            <HelpTip title="Textos" text="Cambia textos visibles en Score Store sin tocar código. Guardas y se refleja en segundos." />
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-black text-slate-700">Título principal (Hero)</label>
              <input
                value={home.hero_title}
                onChange={(e) => setHome((p) => ({ ...p, hero_title: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black text-slate-700">Subtítulo (Hero)</label>
              <textarea
                value={home.hero_subtitle}
                onChange={(e) => setHome((p) => ({ ...p, hero_subtitle: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Botón principal</label>
              <input
                value={home.cta_primary}
                onChange={(e) => setHome((p) => ({ ...p, cta_primary: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Botón secundario</label>
              <input
                value={home.cta_secondary}
                onChange={(e) => setHome((p) => ({ ...p, cta_secondary: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>
          </div>
        </section>

        {/* Promo + Pixel */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Sparkles size={14} className="text-sky-600" /> Promos + Pixel
            <HelpTip title="Promo y Pixel" text="La promo bar aparece arriba en Score Store. El Pixel se activa solo si el usuario acepta cookies." />
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-black text-slate-800">
                <input type="checkbox" checked={!!promo_active} onChange={(e) => setPromoActive(e.target.checked)} className="w-4 h-4" />
                Activar Promo Bar
              </label>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700">Pixel ID (Meta)</label>
              <input
                value={pixel_id}
                onChange={(e) => setPixelId(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                placeholder="000000000000000"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black text-slate-700">Texto de la Promo Bar</label>
              <input
                value={promo_text}
                onChange={(e) => setPromoText(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                placeholder="Ej: ENVÍO GRATIS en compras arriba de $999"
              />
            </div>
          </div>
        </section>

        {/* Imágenes */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <ImageIcon size={14} className="text-sky-600" /> Imágenes
            <HelpTip title="Imágenes" text="Sube imágenes para el hero o branding. Luego guarda para aplicarlo en Score Store." />
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <UploadCard title="Hero background" tip="Imagen grande (recom: 1600px+)." url={theme.hero_bg_url} onPick={(f) => onUpload("hero_bg", f)} />
            <UploadCard title="Logo URL" tip="Logo principal (PNG/WEBP)." url={theme.logo_url} onPick={(f) => onUpload("logo", f)} />
            <UploadCard title="Badge temporada" tip="Badge pequeño (PNG)." url={theme.season_badge_url} onPick={(f) => onUpload("badge", f)} />
          </div>
        </section>

        {/* Operación */}
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Sparkles size={14} className="text-sky-600" /> Operación
            <HelpTip title="Operación" text="Control de correo de soporte y modo mantenimiento. Mantenimiento pausa compras sin tirar el sitio." />
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-slate-700">Correo de soporte</label>
              <input
                value={contact_email}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-black text-slate-800">
                <input
                  type="checkbox"
                  checked={!!maintenance_mode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="w-4 h-4"
                />
                Modo mantenimiento
              </label>
            </div>
          </div>
        </section>

        <p className="text-xs font-semibold text-slate-500">
          Tip: si guardas y no ves cambios, refresca Score Store y espera 5–20s (caché/CDN).
        </p>
      </main>
    </div>
  );
}

function UploadCard({ title, tip, url, onPick }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-900">{title}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{tip}</p>
        </div>

        <label className="px-3 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs flex items-center gap-2 cursor-pointer">
          <UploadCloud size={14} />
          Subir
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick?.(e.target.files?.[0] || null)} />
        </label>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="w-full h-[140px] object-contain bg-white" />
        ) : (
          <div className="w-full h-[140px] flex items-center justify-center text-slate-400 font-black text-xs">Sin imagen</div>
        )}
      </div>

      {url ? <p className="text-[11px] font-semibold text-slate-500 mt-2 break-all">{url}</p> : null}
    </div>
  );
}