// src/app/scorestore-settings/page.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Home,
  Loader2,
  Mail,
  Palette,
  Phone,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Truck,
  Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  hero_title: safeStr(settings?.hero_title || "SCORE STORE"),
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

function Shell({ children }) {
  return (
    <main className="min-h-screen px-4 py-6 md:py-8 unicos-shell">
      <div className="mx-auto w-full max-w-[1440px]">{children}</div>
    </main>
  );
}

function Panel({ className = "", children }) {
  return (
    <section
      className={clsx(
        "unicos-panel overflow-hidden border border-white/10 bg-[rgba(8,18,34,0.86)] shadow-2xl",
        className
      )}
    >
      {children}
    </section>
  );
}

function SectionTitle({ eyebrow, title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-slate-300">{subtitle}</p> : null}
      </div>
      {Icon ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sky-300">
          <Icon size={18} />
        </div>
      ) : null}
    </div>
  );
}

function Pill({ children, tone = "blue" }) {
  const styles = {
    blue: "border-sky-400/20 bg-sky-500/10 text-sky-100",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    white: "border-white/10 bg-white/5 text-white",
  };

  return (
    <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]", styles[tone] || styles.blue)}>
      {children}
    </span>
  );
}

function Field({ label, value, onChange, placeholder = "", type = "text", hint = "", icon: Icon }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
        {hint ? <span className="text-[10px] font-bold text-slate-500">{hint}</span> : null}
      </div>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /> : null}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition",
            Icon ? "pl-10" : "",
            "placeholder:text-slate-500 focus:border-sky-400/40 focus:bg-white/7"
          )}
        />
      </div>
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder = "", rows = 3, hint = "" }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
        {hint ? <span className="text-[10px] font-bold text-slate-500">{hint}</span> : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 focus:bg-white/7"
      />
    </label>
  );
}

function Toggle({ label, value, onChange, hint = "" }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/8"
    >
      <div>
        <p className="text-sm font-black text-white">{label}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </div>
      <span className={clsx("flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black", value ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/20" : "bg-white/5 text-slate-300 border border-white/10")}>
        {value ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function normalizeSettingsPayload(payload = {}) {
  const src = payload?.site_settings || payload?.settings || payload?.store || payload || {};

  return {
    org_id: safeStr(src.org_id || src.organization_id || ""),
    hero_title: safeStr(src.hero_title || "SCORE STORE"),
    hero_image: safeStr(src.hero_image || ""),
    promo_active: safeBool(src.promo_active, false),
    promo_text: safeStr(src.promo_text || ""),
    pixel_id: safeStr(src.pixel_id || ""),
    maintenance_mode: safeBool(src.maintenance_mode, false),
    season_key: safeStr(src.season_key || "default"),
    theme: {
      accent: safeStr(src.theme?.accent || "#e10600"),
      accent2: safeStr(src.theme?.accent2 || "#111111"),
      particles: safeBool(src.theme?.particles, true),
    },
    home: {
      footer_note: safeStr(src.home?.footer_note || ""),
      shipping_note: safeStr(src.home?.shipping_note || ""),
      returns_note: safeStr(src.home?.returns_note || ""),
      support_hours: safeStr(src.home?.support_hours || ""),
    },
    socials: {
      facebook: safeStr(src.socials?.facebook || ""),
      instagram: safeStr(src.socials?.instagram || ""),
      youtube: safeStr(src.socials?.youtube || ""),
      tiktok: safeStr(src.socials?.tiktok || ""),
    },
    contact: {
      email: safeStr(src.contact?.email || src.contact_email || ""),
      phone: safeStr(src.contact?.phone || src.contact_phone || ""),
      whatsapp_e164: safeStr(src.contact?.whatsapp_e164 || src.whatsapp_e164 || ""),
      whatsapp_display: safeStr(src.contact?.whatsapp_display || src.whatsapp_display || ""),
    },
  };
}

export default function ScorestoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(getInitialForm(null));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState("Conectando al panel...");
  const [copied, setCopied] = useState("");

  const apiHeaders = useMemo(() => {
    return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
  }, [sessionToken]);

  const previewUrl = SCORESTORE_URL || "https://scorestore.vercel.app";
  const heroPreview = form.hero_title || "SCORE STORE";
  const activeTheme = form.theme?.accent || "#e10600";

  const copyText = useCallback(async (value) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setCopied("Copiado al portapapeles.");
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setError("No se pudo copiar.");
    }
  }, []);

  const load = useCallback(
    async (tokenArg = sessionToken) => {
      if (!tokenArg) {
        setLoading(false);
        setStatus("Sesión requerida para editar ajustes.");
        setError("Inicia sesión en UnicOs para cargar este panel.");
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");
      setStatus("Cargando ajustes públicos...");

      try {
        const res = await fetch("/api/score/site-settings", {
          method: "GET",
          headers: tokenArg ? { Authorization: `Bearer ${tokenArg}` } : {},
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "No se pudieron cargar los ajustes");
        }

        const normalized = normalizeSettingsPayload(data);
        setSettings(normalized);
        setForm(getInitialForm(normalized));
        setStatus("Ajustes listos para editar.");
      } catch (e) {
        setError(String(e?.message || e || "Error desconocido"));
        setStatus("No se pudieron cargar los ajustes.");
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    let alive = true;
    let sub = null;

    const boot = async () => {
      if (!supabase) {
        if (!alive) return;
        setLoading(false);
        setStatus("Supabase no está configurado.");
        setError("Falta conectar la instancia de Supabase en este entorno.");
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!alive) return;

        const token = session?.access_token || "";
        setSessionToken(token);

        if (!token) {
          setLoading(false);
          setStatus("Inicia sesión en UnicOs.");
          return;
        }

        await load(token);
      } catch (e) {
        if (!alive) return;
        setLoading(false);
        setStatus("No se pudo validar la sesión.");
        setError(String(e?.message || e));
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!alive) return;
        const nextToken = session?.access_token || "";
        setSessionToken(nextToken);

        if (!nextToken) {
          setSettings(null);
          setForm(getInitialForm(null));
          setLoading(false);
          setStatus("Sesión cerrada.");
          return;
        }

        load(nextToken);
      });

      sub = subscription || null;
    };

    boot();

    return () => {
      alive = false;
      sub?.unsubscribe?.();
    };
  }, [load]);

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
    if (!sessionToken) {
      setError("Debes iniciar sesión nuevamente.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    setStatus("Guardando ajustes...");

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
        contact_email: safeStr(form.contact?.email || ""),
        contact_phone: safeStr(form.contact?.phone || ""),
        whatsapp_e164: safeStr(form.contact?.whatsapp_e164 || ""),
        whatsapp_display: safeStr(form.contact?.whatsapp_display || ""),
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

      const normalized = normalizeSettingsPayload(data);
      setSettings(normalized);
      setForm(getInitialForm(normalized));
      setSuccess("Ajustes guardados correctamente.");
      setStatus("Sincronizado.");
    } catch (e) {
      setError(String(e?.message || e || "Error desconocido"));
      setStatus("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const scoreStoreHref = previewUrl.startsWith("http") ? previewUrl : `https://${previewUrl}`;

  return (
    <Shell>
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,18,34,0.96),rgba(7,12,20,0.98))] shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 border-b border-white/10 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="unicos-brand-frame h-14 w-14 overflow-hidden rounded-[18px] p-2">
                <Image
                  src="/logo-unico.png"
                  alt="UnicOs"
                  width={56}
                  height={56}
                  className="h-full w-full rounded-[14px] object-contain"
                  priority
                />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-300">
                  Ajustes premium
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Score Store Settings
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Hero, promociones, mantenimiento, branding, notas del sitio y contacto público, todo sincronizado con Score Store.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill tone="blue">
                <ShieldCheck size={12} />
                {status}
              </Pill>
              <Pill tone={form.promo_active ? "emerald" : "amber"}>
                {form.promo_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                Promo {form.promo_active ? "activa" : "inactiva"}
              </Pill>
              <Pill tone={form.maintenance_mode ? "amber" : "emerald"}>
                <Wand2 size={12} />
                {form.maintenance_mode ? "Mantenimiento" : "En vivo"}
              </Pill>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={scoreStoreHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ExternalLink size={16} />
              Abrir tienda
            </a>

            <button
              type="button"
              onClick={() => copyText(scoreStoreHref)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Copy size={16} />
              Copiar URL
            </button>

            <button
              type="button"
              onClick={() => load(sessionToken)}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Recargar
            </button>
          </div>

          {copied ? (
            <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {copied}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {success}
            </p>
          ) : null}
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-[1.05fr_.95fr] md:px-6">
          <div className