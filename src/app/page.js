"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  BarChart3,
  Boxes,
  Bot,
  CircleDollarSign,
  ExternalLink,
  Eye,
  Gauge,
  Layers3,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Wand2,
} from "lucide-react";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
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

// 🔥 MEJORA UX: Formulario Nativo en lugar de window.prompt
function LoginScreen({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      onLogin(email.trim());
    }
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
                    <Image src="/logo-unico.png" alt="UnicOs" fill className="object-contain p-2 rounded-[20px]" sizes="80px" priority />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Centro de mando</p>
                    <h1 className="mt-1 text-4xl md:text-5xl font-black leading-none">
                      <span className="unicos-blue-text">UnicOs</span>
                    </h1>
                  </div>
                </div>

                <h2 className="mt-10 text-3xl md:text-5xl font-black leading-[1.02] text-white">
                  Controla operaciones, campañas, contenido y seguimiento desde un solo centro de mando.
                </h2>

                <p className="mt-5 max-w-xl text-sm md:text-[15px] leading-relaxed text-slate-300">
                  UnicOs está diseñado para coordinar tiendas, campañas, contenido, atención, seguimiento y operación
                  diaria sin depender del equipo técnico para cada ajuste.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  <StatusPill ok tone="blue">Acceso seguro</StatusPill>
                  <StatusPill ok tone="emerald">Panel conectado</StatusPill>
                  <StatusPill ok tone="blue">Cambios en tiempo real</StatusPill>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] border-l border-white/10 flex items-center">
              <div className="mx-auto w-full max-w-md animate-unicos-slide-up">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">Acceso seguro</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Entrar al panel maestro</h3>
                  <p className="mt-3 mb-6 text-sm leading-relaxed text-slate-300">
                    Recibe un enlace mágico en tu correo y entra directo al panel.
                  </p>

                  {error ? (
                    <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                      {error}
                    </div>
                  ) : null}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="unicos-label">Correo Electrónico</label>
                      <input 
                        id="email"
                        type="email" 
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com" 
                        className="unicos-input bg-black/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className={cls(
                        "w-full unicos-btn px-4 py-4 text-sm text-white transition-all flex justify-center items-center gap-2",
                        loading || !email
                          ? "bg-white/10 border border-white/10 opacity-70"
                          : "bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 shadow-[0_18px_50px_rgba(42,168,255,0.28)]"
                      )}
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : "Recibir acceso por correo"}
                    </button>
                  </form>

                  <p className="mt-5 text-xs leading-relaxed text-slate-400 text-center">
                    El sistema detectará automáticamente tu perfil y te dará acceso a las áreas correspondientes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function FinanceSummary({ token, orgId, role }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const canView = ["owner", "admin", "marketing"].includes(safeStr(role).toLowerCase());

  const load = useCallback(async () => {
    if (!token || !orgId || !canView) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/stripe/summary?org_id=${encodeURIComponent(orgId)}&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || "No se pudo leer el resumen financiero.");

      setData(payload);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [token, orgId, canView]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) return null;

  if (loading) {
    return (
      <Panel className="p-6">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="animate-spin" size={18} />
          <span className="font-semibold">Cargando resumen ejecutivo...</span>
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="p-6">
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
          {error}
        </div>
      </Panel>
    );
  }

  const kpi = data?.kpi || {};

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={<CircleDollarSign size={20} />}
        label="Ventas"
        value={money(kpi.sales_mxn)}
        hint="Últimos 30 días"
      />
      <MetricCard
        icon={<BarChart3 size={20} />}
        label="Comisión cobros"
        value={money(kpi.stripe_fee_mxn)}
        hint="Cobro de pagos"
      />
      <MetricCard
        icon={<Truck size={20} />}
        label="Costo envíos"
        value={money(kpi.envia_cost_mxn)}
        hint="Costo operativo"
      />
      <MetricCard
        icon={<Gauge size={20} />}
        label="Ganancia"
        value={money(kpi.visible_profit_mxn)}
        hint="Vista simple"
      />
    </div>
  );
}

function HealthSummary({ token }) {
  const [status, setStatus] = useState({
    auth: "warn",
    stripe: "warn",
    db: "warn",
    envia: "warn",
    ia: "warn",
  });

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/bootstrap", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) throw new Error();

      setStatus({
        auth: "ok",
        stripe: data?.health?.stripe ? "ok" : "warn",
        db: data?.health?.supabase ? "ok" : "warn",
        envia: data?.health?.envia ? "ok" : "warn",
        ia: data?.health?.ia ? "ok" : "warn",
      });
    } catch {
      setStatus({
        auth: "ok",
        stripe: "warn",
        db: "warn",
        envia: "warn",
        ia: "warn",
      });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Salud del panel</p>
          <h3 className="mt-2 text-xl font-black text-white">Conexiones principales</h3>
        </div>
        <button
          type="button"
          onClick={load}
          className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
        >
          <RefreshCcw size={16} />
          Actualizar
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <HealthBadge label="Acceso" status={status.auth} />
        <HealthBadge label="Cobros" status={status.stripe} />
        <HealthBadge label="Base de datos" status={status.db} />
        <HealthBadge label="Envíos" status={status.envia} />
        <HealthBadge label="Asistente" status={status.ia} />
      </div>
    </Panel>
  );
}

function AIQuickActions({ token, orgId, role }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");

  const run = useCallback(async (msg) => {
    if (!token || !orgId || !msg) return;
    try {
      setLoading(true);
      setAnswer("");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: msg,
          org_id: orgId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No pude completar la solicitud.");

      setAnswer(data.reply || "Listo.");
    } catch (e) {
      setAnswer(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  const canUse = ["owner", "admin", "marketing", "support", "operations"].includes(safeStr(role).toLowerCase());

  if (!canUse) return null;

  return (
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
          <Bot size={20} />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Asistente</p>
          <h3 className="mt-1 text-xl font-black text-white">Pídele tareas o explicaciones</h3>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          "Dame un resumen claro del estado actual del panel.",
          "Muéstrame un resumen simple de ventas y pedidos.",
          "Activa una promo que diga: Envío gratis en pedidos seleccionados.",
          "Explícame para qué sirve cada bloque principal del panel.",
        ].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => run(q)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label className="unicos-label">Escribe una instrucción</label>
        <div className="flex flex-col gap-3 md:flex-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            className="unicos-input flex-1 resize-none"
            placeholder="Ejemplo: prepara un resumen ejecutivo del día, apaga la promo, explícame cómo revisar pedidos o dime qué sigue por cerrar."
          />
          <button
            type="button"
            disabled={loading || !safeStr(input).trim()}
            onClick={() => run(input)}
            className={cls(
              "unicos-btn min-w-[200px] rounded-2xl px-5 py-4 text-sm text-white transition flex justify-center items-center",
              loading || !safeStr(input).trim()
                ? "bg-white/10 border border-white/10 opacity-50"
                : "bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 shadow-[0_18px_50px_rgba(42,168,255,0.28)]"
            )}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Ejecutar"}
          </button>
        </div>
      </div>

      {answer ? (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 animate-unicos-slide-up">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Respuesta</p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{answer}</div>
        </div>
      ) : null}
    </Panel>
  );
}

function OrgCard({ active, onClick, name, description, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "w-full rounded-3xl border p-5 text-left transition",
        active
          ? "border-sky-400/40 bg-sky-500/10 shadow-[0_18px_50px_rgba(42,168,255,0.18)]"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
          {icon}
        </div>
        {active ? <StatusPill ok tone="blue">Activa</StatusPill> : null}
      </div>
      <h4 className="mt-4 text-lg font-black text-white">{name}</h4>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
    </button>
  );
}

function DashboardView({ token, orgId, role, orgName, onGoSettings }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !orgId) return;

    try {
      setLoading(true);
      setError("");

      const [ordersRes, productsRes, auditRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, amount_total_mxn, stripe_session_id, status, created_at, org_id, organization_id")
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("products")
          .select("id,name,sku,price_mxn,stock,section_id,sub_section,rank,image_url,is_active,deleted_at,org_id,organization_id")
          .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
          .is("deleted_at", null)
          .order("rank", { ascending: true })
          .limit(50),
        fetch(`/api/audit/list?org_id=${encodeURIComponent(orgId)}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json().catch(() => ({}))),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (productsRes.error) throw productsRes.error;

      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setAuditRows(Array.isArray(auditRes?.rows) ? auditRes.rows : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const paidOrders = useMemo(
    () => orders.filter((o) => ["paid", "fulfilled"].includes(safeStr(o.status).toLowerCase())),
    [orders]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => !["paid", "fulfilled"].includes(safeStr(o.status).toLowerCase())),
    [orders]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p?.is_active !== false),
    [products]
  );

  // URL dinámica hacia Vercel
  const scoreStoreUrl = process.env.NEXT_PUBLIC_SCORESTORE_URL || "https://scorestore.vercel.app";

  return (
    <main className="min-h-screen px-4 py-6 md:py-8 unicos-shell">
      <div className="unicos-wrap space-y-5 animate-unicos-slide-up">
        <Panel className="overflow-hidden">
          <div className="relative p-6 md:p-8">
            <div className="unicos-orb unicos-orb-blue h-40 w-40 right-[-20px] top-[-20px]" />
            <div className="unicos-orb unicos-orb-teal h-32 w-32 left-[20%] bottom-[-10px]" />

            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-4">
                  <div className="unicos-brand-frame relative h-16 w-16 p-2.5">
                    <Image src="/logo-unico.png" alt="UnicOs" fill className="object-contain p-1.5 rounded-[18px]" sizes="64px" priority />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-300">Centro de mando activo</p>
                    <h1 className="mt-1 text-3xl md:text-4xl font-black leading-none text-white">
                      Bienvenido a <span className="unicos-blue-text">UnicOs</span>
                    </h1>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-sm md:text-[15px] leading-relaxed text-slate-300">
                  Administra operación, contenido, campañas, seguimiento y rendimiento desde un panel visual,
                  conectado y entendible para el equipo.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusPill ok tone="blue">Producción conectada</StatusPill>
                  <StatusPill ok tone="emerald">{safeStr(orgName || "Organización activa")}</StatusPill>
                  <StatusPill ok tone="blue">{safeStr(role || "Perfil")}</StatusPill>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                <button
                  type="button"
                  onClick={load}
                  className="unicos-btn inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                >
                  <RefreshCcw size={16} />
                  Actualizar datos
                </button>

                <button
                  type="button"
                  onClick={onGoSettings}
                  className="unicos-btn inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 px-4 py-3 text-sm text-slate-950 shadow-[0_18px_50px_rgba(42,168,255,0.28)] hover:brightness-110"
                >
                  <Settings2 size={16} />
                  Abrir configuración
                </button>

                <a
                  href={scoreStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="unicos-btn inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                >
                  <ExternalLink size={16} />
                  Ver sitio público
                </a>

                <a
                  href="#panel-ia"
                  className="unicos-btn inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                >
                  <Wand2 size={16} />
                  Usar asistente
                </a>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <OrgCard
            active
            onClick={() => {}}
            name={safeStr(orgName || "Score Store")}
            description="Panel activo para revisar ventas, pedidos, catálogo, mensajes del sitio y seguimiento operativo."
            icon={<Store size={20} />}
          />
          <OrgCard
            active={false}
            onClick={() => {}}
            name="Próximos sitios de Único"
            description="La estructura ya está preparada para sumar nuevos sitios, campañas y tableros sin cambiar la lógica del panel."
            icon={<Layers3 size={20} />}
          />
        </div>

        <HealthSummary token={token} />

        <FinanceSummary token={token} orgId={orgId} role={role} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <MetricCard
            icon={<ShoppingBag size={20} />}
            label="Pedidos pagados"
            value={String(paidOrders.length)}
            hint="Confirmados"
          />
          <MetricCard
            icon={<PackageSearch size={20} />}
            label="Pedidos por revisar"
            value={String(pendingOrders.length)}
            hint="Pendientes o en proceso"
          />
          <MetricCard
            icon={<Boxes size={20} />}
            label="Productos activos"
            value={String(activeProducts.length)}
            hint="Catálogo visible"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Seguimiento</p>
                <h3 className="mt-2 text-xl font-black text-white">Últimos pedidos</h3>
              </div>
              <button
                type="button"
                onClick={load}
                className="unicos-btn inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                <RefreshCcw size={16} />
                Refrescar
              </button>
            </div>

            {loading ? (
              <div className="mt-5 flex items-center gap-3 text-slate-300">
                <Loader2 className="animate-spin" size={18} />
                <span className="font-semibold">Cargando pedidos...</span>
              </div>
            ) : error ? (
              <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
                {error}
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
                <div className="grid grid-cols-[1.15fr_.75fr_.8fr_.7fr] gap-3 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  <div>Pedido</div>
                  <div>Fecha</div>
                  <div>Total</div>
                  <div>Estado</div>
                </div>

                <div className="divide-y divide-white/10">
                  {(orders || []).slice(0, 10).map((row) => (
                    <div key={row.id} className="grid grid-cols-[1.15fr_.75fr_.8fr_.7fr] gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors">
                      <div className="font-bold text-white">{safeStr(row.stripe_session_id || row.id)}</div>
                      <div className="text-slate-300">{dateTime(row.created_at)}</div>
                      <div className="text-slate-200 font-bold">{money(row.amount_total_mxn)}</div>
                      <div>
                        <span
                          className={cls(
                            "inline-flex rounded-full px-3 py-1 text-[11px] font-black",
                            ["paid", "fulfilled"].includes(safeStr(row.status).toLowerCase())
                              ? "bg-emerald-500/14 text-emerald-100 border border-emerald-400/20"
                              : "bg-amber-500/14 text-amber-100 border border-amber-400/20"
                          )}
                        >
                          {safeStr(row.status || "pendiente")}
                        </span>
                      </div>
                    </div>
                  ))}

                  {!orders.length ? (
                    <div className="px-4 py-6 text-sm text-slate-300">
                      Todavía no hay pedidos visibles para esta organización.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Actividad</p>
                <h3 className="mt-1 text-xl font-black text-white">Movimientos recientes</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {(auditRows || []).slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors">
                  <p className="text-sm font-black text-white">{safeStr(row.summary || row.action)}</p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span>{safeStr(row.actor_email || "Sistema")}</span>
                    <span>{dateTime(row.created_at)}</span>
                  </div>
                </div>
              ))}

              {!auditRows.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-300">
                  Todavía no hay actividad reciente visible en el panel.
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <div id="panel-ia">
          <AIQuickActions token={token} orgId={orgId} role={role} />
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [view, setView] = useState("dashboard");
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

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

      // Dinamismo para Vercel
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL || "https://unicos-admin.vercel.app");

      const { error } = await supabase.auth.signInWithOtp({
        email: emailToLogin,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;

      alert(`Listo. Te envié un acceso seguro a ${emailToLogin}. Revisa tu bandeja o SPAM.`);
    } catch (e) {
      setGlobalError(String(e?.message || e));
    } finally {
      setAuthLoading(false);
    }
  }, []);

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
              <Image src="/logo-unico.png" alt="UnicOs" width={80} height={80} className="h-full w-full object-contain rounded-[18px]" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">Configuración pendiente</p>
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
    return <LoginScreen onLogin={handleLogin} loading={authLoading} error={globalError} />;
  }

  if (view === "settings") {
    return (
      <div className="min-h-screen px-4 py-6 unicos-shell animate-unicos-slide-up">
        <div className="unicos-wrap space-y-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Configuración</p>
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
