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

function SectionCard({ title, subtitle, helpTitle, helpText, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
        </div>
        {helpTitle && helpText ? <HelpTip title={helpTitle} text={helpText} /> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-slate-800">{label}</span>
      </div>
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none",
        "placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
        props.className
      )}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none",
        "placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
        props.className
      )}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none",
        "focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
        props.className
      )}
    />
  );
}

function StatusPill({ ok, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black",
        ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      )}
    >
      <span className={clsx("w-2 h-2 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
      {children}
    </span>
  );
}

export default function ScoreStoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [store_name, setStoreName] = useState("Score Store");
  const [store_tagline, setStoreTagline] = useState("");
  const [hero_title, setHeroTitle] = useState("");
  const [hero_copy, setHeroCopy] = useState("");
  const [hero_note, setHeroNote] = useState("");
  const [primary_cta_label, setPrimaryCtaLabel] = useState("Comprar ahora");
  const [primary_cta_href, setPrimaryCtaHref] = useState("/productos");
  const [secondary_cta_label, setSecondaryCtaLabel] = useState("Ver catálogo");
  const [secondary_cta_href, setSecondaryCtaHref] = useState("/productos");
  const [hero_image_url, setHeroImageUrl] = useState("");
  const [hero_gallery, setHeroGallery] = useState([]);
  const [contact_email, setContactEmail] = useState("");
  const [contact_phone, setContactPhone] = useState("");
  const [whatsapp_number, setWhatsappNumber] = useState("");
  const [address_line, setAddressLine] = useState("");
  const [shipping_note, setShippingNote] = useState("");
  const [returns_note, setReturnsNote] = useState("");
  const [support_hours, setSupportHours] = useState("");
  const [instagram_url, setInstagramUrl] = useState("");
  const [facebook_url, setFacebookUrl] = useState("");
  const [tiktok_url, setTiktokUrl] = useState("");
  const [theme_mode, setThemeMode] = useState("light");
  const [accent_hex, setAccentHex] = useState("#2563eb");
  const [footer_note, setFooterNote] = useState("");
  const [seo_title, setSeoTitle] = useState("");
  const [seo_description, setSeoDescription] = useState("");

  const configured = useMemo(() => !!SUPABASE_CONFIGURED, []);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        setLoading(true);
        setError("");
        setOkMsg("");

        if (!configured || !supabase) {
          throw new Error("Supabase no está configurado en este entorno.");
        }

        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;
        if (!session?.access_token) throw new Error("No hay sesión activa en UnicOs.");

        if (!alive) return;
        setSessionReady(true);

        const { data, error: readErr } = await supabase
          .from("store_settings")
          .select("*")
          .eq("organization_id", SCORE_ORG_ID)
          .maybeSingle();

        if (readErr) throw readErr;

        if (data) {
          setStoreName(String(data.store_name || "Score Store"));
          setStoreTagline(String(data.store_tagline || ""));
          setHeroTitle(String(data.hero_title || ""));
          setHeroCopy(String(data.hero_copy || ""));
          setHeroNote(String(data.hero_note || ""));
          setPrimaryCtaLabel(String(data.primary_cta_label || "Comprar ahora"));
          setPrimaryCtaHref(String(data.primary_cta_href || "/productos"));
          setSecondaryCtaLabel(String(data.secondary_cta_label || "Ver catálogo"));
          setSecondaryCtaHref(String(data.secondary_cta_href || "/productos"));
          setHeroImageUrl(String(data.hero_image_url || ""));
          setHeroGallery(Array.isArray(data.hero_gallery) ? data.hero_gallery.filter(Boolean) : []);
          setContactEmail(String(data?.contact_email || ""));
          setContactPhone(String(data.contact_phone || ""));
          setWhatsappNumber(String(data.whatsapp_number || ""));
          setAddressLine(String(data.address_line || ""));
          setShippingNote(String(data.shipping_note || ""));
          setReturnsNote(String(data.returns_note || ""));
          setSupportHours(String(data.support_hours || ""));
          setInstagramUrl(String(data.instagram_url || ""));
          setFacebookUrl(String(data.facebook_url || ""));
          setTiktokUrl(String(data.tiktok_url || ""));
          setThemeMode(String(data.theme_mode || "light"));
          setAccentHex(String(data.accent_hex || "#2563eb"));
          setFooterNote(String(data.footer_note || ""));
          setSeoTitle(String(data.seo_title || ""));
          setSeoDescription(String(data.seo_description || ""));
        }
      } catch (e) {
        if (!alive) return;
        setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      alive = false;
    };
  }, [configured]);
  async function uploadFileToBucket(file, folder = "scorestore") {
    if (!supabase) throw new Error("Supabase no está listo.");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Tu sesión expiró. Vuelve a entrar a UnicOs.");

    const ext = String(file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage.from("assets").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from("assets").getPublicUrl(fileName);
    const url = data?.publicUrl || "";
    if (!url) throw new Error("No se pudo generar URL pública del archivo.");
    return url;
  }

  async function onUploadCover(e) {
    try {
      setError("");
      const file = e.target.files?.[0];
      if (!file) return;
      setCoverUploading(true);
      const url = await uploadFileToBucket(file, "scorestore/hero");
      setHeroImageUrl(url);
      setOkMsg("Portada subida correctamente.");
    } catch (e2) {
      setError(String(e2?.message || e2));
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  }

  async function onUploadGallery(e) {
    try {
      setError("");
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setGalleryUploading(true);

      const uploaded = [];
      for (const file of files) {
        const url = await uploadFileToBucket(file, "scorestore/gallery");
        uploaded.push(url);
      }

      setHeroGallery((prev) => Array.from(new Set([...(prev || []), ...uploaded])));
      setOkMsg("Imágenes agregadas correctamente.");
    } catch (e2) {
      setError(String(e2?.message || e2));
    } finally {
      setGalleryUploading(false);
      e.target.value = "";
    }
  }

  function removeGalleryUrl(url) {
    setHeroGallery((prev) => (prev || []).filter((x) => x !== url));
  }

  async function onSave() {
    try {
      setSaving(true);
      setError("");
      setOkMsg("");

      if (!configured || !supabase) {
        throw new Error("Supabase no está configurado.");
      }

      const payload = {
        organization_id: SCORE_ORG_ID,
        store_name,
        store_tagline,
        hero_title,
        hero_copy,
        hero_note,
        primary_cta_label,
        primary_cta_href,
        secondary_cta_label,
        secondary_cta_href,
        hero_image_url,
        hero_gallery,
        contact_email,
        contact_phone,
        whatsapp_number,
        address_line,
        shipping_note,
        returns_note,
        support_hours,
        instagram_url,
        facebook_url,
        tiktok_url,
        theme_mode,
        accent_hex,
        footer_note,
        seo_title,
        seo_description,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from("store_settings")
        .upsert(payload, { onConflict: "organization_id" });

      if (upsertErr) throw upsertErr;

      setOkMsg("Configuración guardada correctamente.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto">
            <RefreshCcw className="animate-spin text-blue-700" size={20} />
          </div>
          <p className="mt-4 text-base font-black text-slate-900">Cargando ajustes de Score Store...</p>
          <p className="mt-1 text-sm text-slate-500">Estamos leyendo la configuración real desde Supabase.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Volver
            </a>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">UnicOs / Score Store</p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Configuración de la tienda</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill ok={configured && sessionReady}>Conexión real lista</StatusPill>
            <a
              href="https://scorestore.netlify.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              Ver sitio
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={clsx(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white",
                saving ? "bg-slate-400" : "bg-blue-700 hover:bg-blue-800"
              )}
            >
              {saving ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar cambios
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        {okMsg ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {okMsg}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">
            <SectionCard
              title="Hero principal"
              subtitle="Aquí controlas el bloque principal respetando el copy de la tienda."
              helpTitle="Hero principal"
              helpText="Este bloque impacta lo primero que ve la gente. Cuida títulos claros, una nota corta y llamadas a la acción directas."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nombre de tienda">
                  <Input value={store_name} onChange={(e) => setStoreName(e.target.value)} placeholder="Score Store" />
                </Field>
                <Field label="Tagline corto">
                  <Input value={store_tagline} onChange={(e) => setStoreTagline(e.target.value)} placeholder="Merch oficial y coleccionables" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Título principal">
                    <Input value={hero_title} onChange={(e) => setHeroTitle(e.target.value)} placeholder="El mejor merch oficial de SCORE" />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Copy del hero">
                    <Textarea rows={5} value={hero_copy} onChange={(e) => setHeroCopy(e.target.value)} placeholder="Texto principal del hero..." />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Nota corta">
                    <Input value={hero_note} onChange={(e) => setHeroNote(e.target.value)} placeholder="Ediciones limitadas, envíos y novedades" />
                  </Field>
                </div>
                <Field label="Texto botón principal">
                  <Input value={primary_cta_label} onChange={(e) => setPrimaryCtaLabel(e.target.value)} placeholder="Comprar ahora" />
                </Field>
                <Field label="Destino botón principal">
                  <Input value={primary_cta_href} onChange={(e) => setPrimaryCtaHref(e.target.value)} placeholder="/productos" />
                </Field>
                <Field label="Texto botón secundario">
                  <Input value={secondary_cta_label} onChange={(e) => setSecondaryCtaLabel(e.target.value)} placeholder="Ver catálogo" />
                </Field>
                <Field label="Destino botón secundario">
                  <Input value={secondary_cta_href} onChange={(e) => setSecondaryCtaHref(e.target.value)} placeholder="/productos" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Imagen principal y galería"
              subtitle="Sube una portada limpia y varias imágenes de apoyo."
              helpTitle="Imágenes"
              helpText="Usa portada clara, enfoque al producto y materiales reales. Evita imágenes con texto ilegible o fondos saturados."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="URL de portada">
                  <Input value={hero_image_url} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Subir nueva portada">
                  <label className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 px-4 py-4 flex items-center justify-center gap-2 cursor-pointer text-sm font-black text-slate-700">
                    {coverUploading ? <RefreshCcw className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                    {coverUploading ? "Subiendo..." : "Seleccionar archivo"}
                    <input type="file" accept="image/*" className="hidden" onChange={onUploadCover} />
                  </label>
                </Field>
              </div>
              {hero_image_url ? (
                <div className="mt-4 rounded-3xl border border-slate-200 overflow-hidden bg-slate-100">
                  <img src={hero_image_url} alt="Portada" className="w-full h-[220px] object-cover" />
                </div>
              ) : null}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">Galería secundaria</p>
                  <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 cursor-pointer text-sm font-black text-slate-800 hover:bg-slate-50">
                    {galleryUploading ? <RefreshCcw className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                    {galleryUploading ? "Subiendo..." : "Agregar imágenes"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onUploadGallery} />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(hero_gallery || []).map((url) => (
                    <div key={url} className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <img src={url} alt="Galería" className="w-full h-36 object-cover" />
                      <div className="p-3">
                        <button
                          type="button"
                          onClick={() => removeGalleryUrl(url)}
                          className="w-full rounded-2xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-black hover:bg-rose-100"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Contacto y soporte"
              subtitle="Estos datos deben ser oficiales y visibles para clientes."
              helpTitle="Contacto"
              helpText="Aquí van los datos reales que alimentan footer, soporte y confianza de compra. Evita correos temporales o placeholders."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Correo de contacto">
                  <Input value={contact_email} onChange={(e) => setContactEmail(e.target.value)} placeholder="correo@dominio.com" />
                </Field>
                <Field label="Teléfono">
                  <Input value={contact_phone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+52 ..." />
                </Field>
                <Field label="WhatsApp">
                  <Input value={whatsapp_number} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="526641234567" />
                </Field>
                <Field label="Horario de soporte">
                  <Input value={support_hours} onChange={(e) => setSupportHours(e.target.value)} placeholder="Lunes a viernes de 9:00 a 18:00" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Dirección o referencia">
                    <Input value={address_line} onChange={(e) => setAddressLine(e.target.value)} placeholder="Tijuana, Baja California, México" />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Nota de envíos">
                    <Textarea rows={3} value={shipping_note} onChange={(e) => setShippingNote(e.target.value)} placeholder="Tiempos de entrega, cobertura y observaciones..." />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Nota de cambios y devoluciones">
                    <Textarea rows={3} value={returns_note} onChange={(e) => setReturnsNote(e.target.value)} placeholder="Política clara y fácil de entender..." />
                  </Field>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Redes y SEO"
              subtitle="Controla presencia pública y metadata principal."
              helpTitle="SEO y redes"
              helpText="Esto ayuda a que la marca se vea seria, conectada y encontrable. Usa títulos claros y descripciones concisas."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Instagram URL">
                  <Input value={instagram_url} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
                </Field>
                <Field label="Facebook URL">
                  <Input value={facebook_url} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
                </Field>
                <Field label="TikTok URL">
                  <Input value={tiktok_url} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@..." />
                </Field>
                <Field label="Modo visual">
                  <Select value={theme_mode} onChange={(e) => setThemeMode(e.target.value)}>
                    <option value="light">Claro</option>
                    <option value="dark">Oscuro</option>
                  </Select>
                </Field>
                <Field label="Color acento">
                  <Input value={accent_hex} onChange={(e) => setAccentHex(e.target.value)} placeholder="#2563eb" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Nota footer">
                    <Textarea rows={3} value={footer_note} onChange={(e) => setFooterNote(e.target.value)} placeholder="Texto breve para el footer..." />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="SEO title">
                    <Input value={seo_title} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Score Store | Merch oficial" />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="SEO description">
                    <Textarea rows={3} value={seo_description} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Descripción para buscadores..." />
                  </Field>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5">
            <SectionCard
              title="Vista rápida"
              subtitle="Resumen de estado actual del panel."
              helpTitle="Vista rápida"
              helpText="Te da una lectura simple para detectar si ya está todo listo: conexión, medios, contacto y salida pública."
            >
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Estado</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill ok={configured}>Supabase configurado</StatusPill>
                    <StatusPill ok={sessionReady}>Sesión activa</StatusPill>
                    <StatusPill ok={!!hero_image_url}>Portada lista</StatusPill>
                    <StatusPill ok={!!contact_email}>Correo listo</StatusPill>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <p className="text-sm font-black text-slate-900">{store_name || "Score Store"}</p>
                  <p className="text-sm text-slate-500 mt-1">{store_tagline || "Sin tagline configurado"}</p>
                  <div className="mt-3 text-xs text-slate-500 space-y-1">
                    <p><span className="font-black text-slate-700">Correo:</span> {contact_email || "No configurado"}</p>
                    <p><span className="font-black text-slate-700">WhatsApp:</span> {whatsapp_number || "No configurado"}</p>
                    <p><span className="font-black text-slate-700">Soporte:</span> {support_hours || "No configurado"}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className={clsx(
                    "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white",
                    saving ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
                  )}
                >
                  {saving ? <RefreshCcw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Guardar configuración
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}
