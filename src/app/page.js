// src/app/page.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  BarChart3,
  Boxes,
  Bot,
  CircleDollarSign,
  Eye,
  Gauge,
  History,
  Layers3,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Wand2,
  X,
} from "lucide-react";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import AiDock from "@/app/ai-dock";

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function money(v) {
  const n = Number(v);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(safe);
}

function dateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function cls(...args) {
  return clsx(args);
}

function Panel({ className = "", children }) {
  return <section className={cls("unicos-panel", className)}>{children}</section>;
}

function Card({ className = "", children }) {
  return <div className={cls("unicos-card", className)}>{children}</div>;
}

function StatusPill({ ok = true, tone = "blue", children }) {
  return (
    <span
      className={cls(
        "unicos-chip",
        tone === "emerald" && "border-emerald-400/20 text-emerald-200 bg-emerald-500/10",
        tone === "blue" && "border-sky-400/20 text-sky-200 bg-sky-500/10",
        tone === "amber" && "border-amber-400/20 text-amber-100 bg-amber-500/10",
        tone === "rose" && "border-rose-400/20 text-rose-100 bg-rose-500/10",
        !ok && "opacity-80"
      )}
    >
      {children}
    </span>
  );
}

function MetricCard({ icon, label, value, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
          {icon}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
      </div>
    </Card>
  );
}

function HealthBadge({ label, status }) {
  const map = {
    ok: "unicos-badge-ok",
    warn: "unicos-badge-warn",
    bad: "unicos-badge-bad",
  };

  const text = status === "ok" ? "Listo" : status === "warn" ? "Revisar" : "Atención";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <span className={map[status] || map.warn}>{text}</span>
    </div>
  );
}

function LoginScreen({ onLogin, onPasswordLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("magic");

  const submitMagic = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    onLogin(cleanEmail);
  };

  const submitPassword = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;
    if (!cleanEmail || !cleanPassword) return;
    onPasswordLogin(cleanEmail, cleanPassword);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 unicos-shell">
      <div className="unicos-wrap w-full max-w-6xl">
        <Panel className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative p-8 md:p-12 unicos-grid-lines">
              <div className="unicos-orb unicos-orb-blue h-40 w-40 left-[-40px] top-[-20px]" />
              <div className="unicos-orb unicos-orb-teal h-36 w-36 right-[10%] bottom-[8%]" />

              <div className="relative max-w-2xl animate-unicos-slide-up">
                <div className="flex items-center gap-4">
                  <div className="unicos-brand-frame relative h-20 w-20 p-3 animate-unicos-float">
                    <Image
                      src="/logo-unico.png"
                      alt="UnicOs"
                      fill
                      className="object-contain p-2 rounded-[20px]"
                      sizes="80px"
                      priority
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">
                      Centro de mando
                    </p>
                    <h1 className="mt-1 text-4xl md:text-5xl font-black leading-none">
                      <span className="unicos-blue-text">UnicOs</span>
                    </h1>
                  </div>
                </div>

                <h2 className="mt-10 text-3xl md:text-5xl font-black leading-[1.02] text-white">
                  Controla operaciones, campañas, contenido y seguimiento desde un solo centro de mando.
                </h2>

                <p className="mt-5 max-w-xl text-sm md:text-[15px] leading-relaxed text-slate-300">
                  UnicOs coordina tiendas, campañas, contenido, atención y operación diaria sin depender del equipo técnico para cada ajuste.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  <StatusPill ok tone="blue">Acceso seguro</StatusPill>
                  <StatusPill ok tone="emerald">Panel conectado</StatusPill>
                  <StatusPill ok tone="blue">Cambios en tiempo real</StatusPill>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12 border-t border-white/10 lg:border-t-0 lg:border-l lg:border-white/10 bg-[rgba(255,255,255,0.02)]">
              <div className="mb-8">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Acceso al panel
                </p>
                <h3 className="mt-2 text-3xl font-black text-white">Ingresa con tu correo</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  El acceso por enlace mágico sigue activo para usuarios estándar. La cuenta owner puede entrar con contraseña.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                <button
                  type="button"
                  onClick={() => setMode("magic")}
                  className={cls(
                    "rounded-2xl px-4 py-3 text-sm font-black transition",
                    mode === "magic"
                      ? "bg-sky-500 text-white"
                      : "bg-transparent text-slate-300 hover:text-white"
                  )}
                >
                  Link mágico
                </button>
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={cls(
                    "rounded-2xl px-4 py-3 text-sm font-black transition",
                    mode === "password"
                      ? "bg-sky-500 text-white"
                      : "bg-transparent text-slate-300 hover:text-white"
                  )}
                >
                  Contraseña
                </button>
              </div>

              <form onSubmit={mode === "magic" ? submitMagic : submitPassword} className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Correo
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto.hocker@gmail.com"
                    className="unicos-input w-full rounded-2xl px-4 py-4 text-sm outline-none"
                  />
                </label>

                {mode === "password" ? (
                  <label className="block space-y-2">
                    <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Contraseña
                    </span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="unicos-input w-full rounded-2xl px-4 py-4 text-sm outline-none"
                    />
                  </label>
                ) : (
                  <div className="rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                    Te llegará un enlace seguro por correo.
                  </div>
                )}

                {error ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || (mode === "password" && !password)}
                  className={cls(
                    "w-full rounded-2xl px-5 py-4 text-sm font-black transition flex items-center justify-center gap-2",
                    loading || !email.trim() || (mode === "password" && !password)
                      ? "bg-white/10 border border-white/10 text-white/50 cursor-not-allowed"
                      : "bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 text-slate-950 shadow-[0_18px_50px_rgba(42,168,255,0.28)] hover:brightness-110"
                  )}
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                  {loading ? "Enviando..." : mode === "magic" ? "Enviar acceso" : "Entrar como owner"}
                </button>
              </form>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function MiniStat({ icon, label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sky-200">{icon}</div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-black text-white">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
      </div>
    </Card>
  );
}

function DashboardView({ token, orgId, role, orgName, onGoSettings }) {
  const [health, setHealth] = useState(null);
  const [audit, setAudit] = useState([]);
  const [auditBusy, setAuditBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    {
      role: "assistant",
      content: "Panel listo. Puedes revisar salud, auditoría o abrir ajustes del sitio.",
    },
  ]);

  const canUse = Boolean(token && orgId);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      setHealth(j || null);
    } catch {
      setHealth(null);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    if (!canUse) return;
    setAuditBusy(true);
    try {
      const res = await fetch(`/api/audit/list?org_id=${encodeURIComponent(orgId)}&limit=120`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Desincronización de actividad.");
      setAudit(j.rows || []);
    } catch {
      setAudit([]);
    } finally {
      setAuditBusy(false);
    }
  }, [canUse, orgId, token]);

  useEffect(() => {
    loadHealth();
    loadAudit();
  }, [loadHealth, loadAudit]);

  const filteredAudit = useMemo(() => audit.slice(0, 12), [audit]);

  const sendAi = async () => {
    const msg = aiInput.trim();
    if (!msg || !canUse) return;
    setAiBusy(true);
    setAiInput("");
    setAiMessages((m) => [...m, { role: "user", content: msg }]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, organization_id: orgId }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Error de red IA.");

      setAiMessages((m) => [...m, { role: "assistant", content: j?.reply || "Comando ejecutado con éxito." }]);
    } catch (e) {
      setAiMessages((m) => [
        ...m,
        { role: "assistant", content: `Error de Sistema: ${String(e?.message || e)}` },
      ]);
    } finally {
      setAiBusy(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen px-4 py-6 unicos-shell animate-unicos-slide-up">
      <div className="unicos-wrap space-y-5">
        <Panel className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Centro de control
              </p>
              <h2 className="mt-2 text-3xl font-black text-white">{orgName || "UnicOs"}</h2>
              <p className="mt-2 text-sm text-slate-300">
                Organización: <span className="font-semibold text-white">{orgId || "—"}</span> · Rol:{" "}
                <span className="font-semibold text-white">{role || "viewer"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadHealth}
                className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
              >
                <RefreshCcw size={16} />
                Salud
              </button>
              <button
                type="button"
                onClick={loadAudit}
                className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
              >
                <History size={16} />
                Auditoría
              </button>
              <button
                type="button"
                onClick={onGoSettings}
                className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
              >
                <Settings2 size={16} />
                Ajustes
              </button>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MiniStat icon={<Gauge size={18} />} label="Estado" value={health?.ready ? "Listo" : "Revisar"} hint="Entorno / llaves" />
          <MiniStat icon={<Boxes size={18} />} label="Auditoría" value={audit.length} hint="Últimos registros" />
          <MiniStat icon={<ShieldCheck size={18} />} label="Acceso" value={role || "viewer"} hint="Permisos" />
          <MiniStat icon={<Store size={18} />} label="Tienda" value="Score Store" hint="Conectada" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-5">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Salud del sistema</p>
                <h3 className="mt-2 text-2xl font-black text-white">Variables y estado</h3>
              </div>
              <button
                type="button"
                onClick={loadHealth}
                className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
              >
                <RefreshCcw size={16} />
                Releer
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <HealthBadge label="Supabase" status={health?.env?.NEXT_PUBLIC_SUPABASE_URL ? "ok" : "bad"} />
              <HealthBadge label="Auth pública" status={health?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "ok" : "bad"} />
              <HealthBadge label="Service role" status={health?.env?.SUPABASE_SECRET_KEY ? "ok" : "bad"} />
              <HealthBadge label="Stripe" status={health?.env?.STRIPE_SECRET_KEY ? "ok" : "bad"} />
              <HealthBadge label="Envía" status={health?.env?.ENVIA_API_KEY ? "ok" : "bad"} />
              <HealthBadge label="Gemini" status={health?.env?.GEMINI_API_KEY ? "ok" : "bad"} />
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MetricCard icon={<CircleDollarSign size={18} />} label="Mercado" value="MXN" hint="Tienda en vivo" />
              <MetricCard icon={<Truck size={18} />} label="Envíos" value="Automático" hint="Score Store" />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Actividad</p>
                <h3 className="mt-2 text-2xl font-black text-white">Últimos eventos</h3>
              </div>
              <button
                type="button"
                onClick={loadAudit}
                className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
              >
                <RefreshCcw size={16} />
                Refrescar
              </button>
            </div>

            <div className="mt-5 space-y-3 max-h-[430px] overflow-auto pr-1">
              {auditBusy ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-slate-300">
                  Cargando actividad...
                </div>
              ) : filteredAudit.length ? (
                filteredAudit.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-white">{r.action || "—"}</p>
                        <p className="text-[11px] text-slate-400">
                          {r.actor_email || "Sistema"} · {dateTime(r.created_at)}
                        </p>
                      </div>
                      {r.entity ? <span className="unicos-chip">{r.entity}</span> : null}
                    </div>
                    {r.summary ? <p className="mt-3 text-sm text-slate-300 leading-relaxed">{r.summary}</p> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-slate-300">
                  Sin registros o faltan permisos de administrador.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[.95fr_1.05fr] gap-5">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">IA operativa</p>
                <h3 className="mt-2 text-2xl font-black text-white">UnicOs AI Dock</h3>
              </div>
              <Bot className="text-sky-300" size={20} />
            </div>

            <div className="mt-5 h-[360px] overflow-auto rounded-3xl border border-white/10 bg-black/20 p-4 space-y-3">
              {aiMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={cls(
                    "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-auto bg-sky-500 text-slate-950 font-semibold"
                      : "mr-auto bg-white/8 text-slate-100 border border-white/10"
                  )}
                >
                  {m.content}
                </div>
              ))}
              {aiBusy ? (
                <div className="mr-auto rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-300">
                  Pensando...
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendAi();
                }}
                placeholder="Pregunta por pedidos, settings, envíos, finanzas..."
                className="unicos-input flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={sendAi}
                className="unicos-btn rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-slate-950"
              >
                <Send size={16} />
              </button>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Acciones rápidas</p>
                <h3 className="mt-2 text-2xl font-black text-white">Conexión con Score Store</h3>
              </div>
              <Sparkles className="text-cyan-300" size={20} />
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href={process.env.NEXT_PUBLIC_SCORESTORE_URL || "https://scorestore.vercel.app"}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag size={18} className="text-sky-300" />
                  <p className="font-black text-white">Abrir tienda</p>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Revisar catálogo, checkout y experiencia pública.
                </p>
              </a>

              <button
                type="button"
                onClick={onGoSettings}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <Settings2 size={18} className="text-sky-300" />
                  <p className="font-black text-white">Ajustes del sitio</p>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Branding, promo visible, soporte y conexión pública.
                </p>
              </button>

              <Card className="p-5 md:col-span-2">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-emerald-300" />
                  <p className="font-black text-white">Sincronización</p>
                </div>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  UnicOs queda enlazado con Score Store por Supabase compartido, /api/me, /api/score/site-settings, auditoría, AI y servicios de Stripe/Envía.
                </p>
              </Card>
            </div>
          </Panel>
        </div>

        <AiDock />
      </div>
    </div>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [view, setView] = useState("dashboard");

  const loadSessionAndOrg = useCallback(async () => {
    if (!supabase) {
      setGlobalError("La conexión principal no está configurada.");
      return;
    }

    try {
      setGlobalError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      setSessionToken(accessToken);

      if (!accessToken) return;

      const whoRes = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const who = await whoRes.json().catch(() => ({}));
      if (!whoRes.ok || !who?.ok) throw new Error(who?.error || "No autorizado.");

      const storedOrg =
        typeof window !== "undefined" ? safeStr(window.localStorage.getItem("unicos.org_id") || "") : "";

      const orgs = Array.isArray(who?.organizations) ? who.organizations : [];
      let targetOrg = storedOrg || safeStr(who?.organization_id || "");

      if (!targetOrg && orgs.length) {
        targetOrg = safeStr(orgs[0]?.organization_id || "");
      }

      if (!targetOrg) throw new Error("No encontramos una organización ligada a este acceso.");

      const currentOrg =
        orgs.find((x) => safeStr(x.organization_id) === targetOrg) ||
        orgs[0] ||
        null;

      setOrgId(targetOrg);
      setRole(safeStr(currentOrg?.role || who?.role || ""));
      setOrgName(safeStr(currentOrg?.organization_name || who?.organization_name || ""));

      if (typeof window !== "undefined") {
        window.localStorage.setItem("unicos.org_id", targetOrg);
      }
    } catch (e) {
      setGlobalError(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    loadSessionAndOrg();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSessionAndOrg();
    });

    return () => subscription?.unsubscribe?.();
  }, [mounted, loadSessionAndOrg]);

  const handleLogin = useCallback(async (emailToLogin) => {
    if (!supabase) return;

    try {
      setAuthLoading(true);
      setGlobalError("");

      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "https://unicos-admin.vercel.app";

      const { error } = await supabase.auth.signInWithOtp({
        email: emailToLogin,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setGlobalError(`Listo. Te envié un acceso seguro a ${emailToLogin}. Revisa tu bandeja o SPAM.`);
    } catch (e) {
      setGlobalError(String(e?.message || e));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handlePasswordLogin = useCallback(async (emailToLogin, password) => {
    if (!supabase) return;

    try {
      setAuthLoading(true);
      setGlobalError("");

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (error) throw error;

      await loadSessionAndOrg();
      setGlobalError("Acceso confirmado. Sincronizando panel...");
    } catch (e) {
      setGlobalError(String(e?.message || e));
    } finally {
      setAuthLoading(false);
    }
  }, [loadSessionAndOrg]);

  const handleLogout = useCallback(async () => {
    try {
      if (!supabase) return;
      await supabase.auth.signOut();

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("unicos.org_id");
      }

      setSessionToken("");
      setRole("");
      setOrgId("");
      setOrgName("");
      setView("dashboard");
    } catch (e) {
      setGlobalError(String(e?.message || e));
    }
  }, []);

  if (!mounted) return null;

  if (!SUPABASE_CONFIGURED) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-10 unicos-shell">
        <div className="unicos-wrap w-full max-w-2xl">
          <Panel className="p-8 text-center animate-unicos-slide-up">
            <div className="mx-auto mb-5 h-20 w-20 unicos-brand-frame p-3">
              <Image
                src="/logo-unico.png"
                alt="UnicOs"
                width={80}
                height={80}
                className="h-full w-full object-contain rounded-[18px]"
              />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Configuración pendiente
            </p>
            <h1 className="mt-3 text-3xl font-black text-white">UnicOs no está conectado</h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Falta conectar las llaves públicas del panel para iniciar sesión desde este entorno de Vercel.
            </p>
          </Panel>
        </div>
      </main>
    );
  }

  if (!sessionToken) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onPasswordLogin={handlePasswordLogin}
        loading={authLoading}
        error={globalError}
      />
    );
  }

  if (view === "settings") {
    return (
      <div className="min-h-screen px-4 py-6 unicos-shell animate-unicos-slide-up">
        <div className="unicos-wrap space-y-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Configuración
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">{orgName || "Ajustes del sitio"}</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setView("dashboard")}
                  className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                >
                  <Eye size={16} />
                  Volver al panel
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-400/20"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </Panel>

          <iframe
            title="Ajustes del Sitio"
            src="/scorestore-settings"
            className="h-[calc(100vh-180px)] w-full rounded-[28px] border border-white/10 bg-[rgba(8,18,34,0.82)]"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardView
        token={sessionToken}
        orgId={orgId}
        role={role}
        orgName={orgName}
        onGoSettings={() => setView("settings")}
      />

      <button
        type="button"
        onClick={handleLogout}
        className="unicos-btn fixed bottom-4 right-4 z-50 rounded-[18px] border border-white/10 bg-[rgba(8,18,34,0.88)] px-5 py-3 text-xs font-black text-white shadow-2xl hover:bg-[rgba(8,18,34,0.95)] hover:border-rose-400/20 hover:text-rose-200"
      >
        Cerrar sesión
      </button>
    </>
  );
}