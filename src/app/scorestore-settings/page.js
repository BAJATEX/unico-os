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
