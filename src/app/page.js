"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import {
  Activity,
  BadgeCheck,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Lock,
  Package,
  PiggyBank,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  Truck,
  Wallet,
  BarChart3,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

/* =========================================================
   Supabase client
   ========================================================= */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

const SUPABASE_READY = !!supabase;

/* =========================================================
   Const / helpers
   ========================================================= */
const SCORE_ORG_ID = "1f3b9980-a1c5-4557-b4eb-a75bb9a8aaa6";

const ORG_LABELS = {
  [SCORE_ORG_ID]: "Score Store",
};

const safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));

const money = (v) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(safeNum(v, 0));

const compactMoney = (v) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safeNum(v, 0));

const shortDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

function HealthPill({ ok, label }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black",
        ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      )}
    >
      <span className={clsx("h-2.5 w-2.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
      {label}
    </span>
  );
}

function IconButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.99]",
        className
      )}
    >
      {children}
    </button>
  );
}

function Card({ className = "", children }) {
  return <div className={clsx("rounded-[28px] border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

function SectionTitle({ eyebrow, title, text, action }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">{eyebrow}</p> : null}
        <h2 className="mt-1 text-xl md:text-2xl font-black tracking-tight text-slate-900">{title}</h2>
        {text ? <p className="mt-2 text-sm md:text-[15px] text-slate-500 max-w-3xl">{text}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function MetricCard({ icon, label, value, sub, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-500">{label}</p>
          <p className="mt-2 text-2xl md:text-[28px] font-black tracking-tight text-slate-900">{value}</p>
          {sub ? <p className="mt-2 text-xs font-semibold text-slate-500">{sub}</p> : null}
        </div>
        <div className={clsx("h-12 w-12 rounded-2xl ring-1 flex items-center justify-center", tones[tone])}>{icon}</div>
      </div>
    </Card>
  );
}

function EmptyState({ icon, title, text, action }) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">{icon}</div>
        <p className="mt-4 text-lg font-black tracking-tight text-slate-900">{title}</p>
        <p className="mt-2 text-sm text-slate-500 max-w-lg">{text}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}

function LoadingShell({ label = "Cargando datos reales..." }) {
  return (
    <div className="min-h-[45vh] flex items-center justify-center">
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm p-8 w-full max-w-md">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-200 flex items-center justify-center">
            <RefreshCcw className="animate-spin" size={18} />
          </div>
          <div>
            <p className="text-base font-black text-slate-900">UnicOs</p>
            <p className="text-sm text-slate-500">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpTip({ title, text }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center"
        aria-label={title || "Ayuda"}
        title={title || "Ayuda"}
      >
        <HelpCircle size={16} />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-[60] w-[320px] max-w-[88vw]">
          <div className="rounded-[24px] border border-slate-200 bg-white shadow-2xl p-4">
            <p className="text-sm font-black text-slate-900">{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function TopShell({ orgName, onRefresh, refreshing, onOpenSettings, currentTab, setCurrentTab }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
    { key: "products", label: "Productos", icon: <Package size={16} /> },
    { key: "settings", label: "Ajustes", icon: <Settings size={16} /> },
  ];

  return (
    <Card className="p-4 md:p-5 sticky top-3 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative h-12 w-12 rounded-2xl bg-slate-100 ring-1 ring-slate-200 overflow-hidden shrink-0">
            <Image
              src="/logo-unico.png"
              alt="UnicOs"
              fill
              className="object-contain p-1.5"
              sizes="44px"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] font-black text-blue-700">Panel maestro</p>
            <h1 className="truncate text-xl md:text-2xl font-black tracking-tight text-slate-900">UnicOs</h1>
            <p className="truncate text-sm text-slate-500">{orgName || "Sin organización activa"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTab(tab.key)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition",
                  currentTab === tab.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <IconButton
            type="button"
            onClick={onOpenSettings}
            className="bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Settings size={16} />
            Ajustes
          </IconButton>

          <IconButton
            type="button"
            onClick={onRefresh}
            className="bg-blue-700 text-white hover:bg-blue-800"
          >
            <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
            Actualizar
          </IconButton>
        </div>
      </div>
    </Card>
  );
}

function HeaderBar({ orgName, role, email, onLogout }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative h-14 w-14 rounded-2xl bg-slate-100 ring-1 ring-slate-200 overflow-hidden shrink-0">
            <Image
              src="/logo-unico.png"
              alt="UnicOs"
              fill
              className="object-contain p-2"
              sizes="56px"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] font-black text-blue-700">Producción conectada</p>
            <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 truncate">{orgName || "Sin organización"}</h2>
            <p className="text-sm text-slate-500 truncate">
              {email || "Sin correo"} · {safeStr(role || "sin rol").toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HealthPill ok={SUPABASE_READY} label="Supabase" />
          <HealthPill ok label="Stripe" />
          <HealthPill ok label="Envia" />
          <HealthPill ok label="IA" />

          <IconButton
            type="button"
            onClick={onLogout}
            className="bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Lock size={16} />
            Salir
          </IconButton>
        </div>
      </div>
    </Card>
  );
}

function LoginCard({ onLogin, loading, error }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <Card className="p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 rounded-2xl bg-slate-100 ring-1 ring-slate-200 overflow-hidden">
              <Image src="/logo-unico.png" alt="UnicOs" fill className="object-contain p-2" sizes="56px" priority />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] font-black text-blue-700">Control total</p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">UnicOs</h1>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] bg-slate-50 ring-1 ring-slate-200 p-5">
            <p className="text-base font-black text-slate-900">Acceso al panel maestro</p>
            <p className="mt-2 text-sm text-slate-500">
              Entra con tu acceso real de Supabase para administrar Score Store desde UnicOs.
            </p>

            {error ? (
              <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              disabled={loading}
              onClick={onLogin}
              className={clsx(
                "mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition",
                loading ? "bg-slate-400" : "bg-blue-700 hover:bg-blue-800"
              )}
            >
              {loading ? "Entrando..." : "Entrar con magic link"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FinanceSummary({ token, orgId, role }) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  const load = useCallback(async () => {
    if (!token || !orgId) return;
    try {
      setState({ loading: true, error: "", data: null });
      const res = await fetch(`/api/stripe/summary?org_id=${encodeURIComponent(orgId)}&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo cargar resumen financiero.");
      setState({ loading: false, error: "", data });
    } catch (e) {
      setState({ loading: false, error: String(e?.message || e), data: null });
    }
  }, [token, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!["owner", "admin", "marketing"].includes(safeStr(role).toLowerCase())) return null;

  if (state.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 animate-pulse">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-40 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-28 rounded bg-slate-200" />
          </Card>
        ))}
      </div>
    );
  }

  if (state.error) {
    return (
      <EmptyState
        icon={<Wallet size={20} />}
        title="No pude cargar el resumen financiero"
        text={state.error}
        action={
          <IconButton type="button" onClick={load} className="bg-slate-900 text-white hover:bg-slate-800">
            <RefreshCcw size={16} />
            Reintentar
          </IconButton>
        }
      />
    );
  }

  const kpi = state.data?.kpi || {};

return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard
        icon={<PiggyBank size={20} />}
        label="Ventas"
        value={money(kpi.sales_mxn)}
        sub="Últimos 30 días"
        tone="blue"
      />
      <MetricCard
        icon={<CreditCard size={20} />}
        label="Comisión Stripe"
        value={money(kpi.stripe_fee_mxn)}
        sub="Cargos de pago"
        tone="amber"
      />
      <MetricCard
        icon={<Truck size={20} />}
        label="Costo envíos"
        value={money(kpi.envia_cost_mxn)}
        sub="Costo operativo"
        tone="slate"
      />
      <MetricCard
        icon={<Wallet size={20} />}
        label="Ganancia"
        value={money(kpi.visible_profit_mxn)}
        sub="Lectura simple del panel"
        tone="emerald"
      />
    </div>
  );
}

function DashboardView({ token, orgId, role }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [enviaSummary, setEnviaSummary] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!supabase || !orgId) return;
    try {
      setLoading(true);
      setError("");

      const { data: orders, error: ordersErr } = await supabase
        .from("orders")
        .select("id, amount_total_mxn, stripe_session_id, status, created_at, org_id, organization_id")
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .in("status", ["paid", "fulfilled"])
        .order("created_at", { ascending: false })
        .limit(800);

      if (ordersErr) throw ordersErr;

      let enviaData = null;
      try {
        const res = await fetch(`/api/envia/summary?org_id=${encodeURIComponent(orgId)}&days=30`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) enviaData = data;
      } catch {}

      if (!mountedRef.current) return;
      setOrders(Array.isArray(orders) ? orders : []);
      setEnviaSummary(enviaData);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(String(e?.message || e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const totalSales = useMemo(
    () => (orders || []).reduce((acc, o) => acc + safeNum(o?.amount_total_mxn, 0), 0),
    [orders]
  );

  const totalOrders = orders?.length || 0;
  const fulfilled = (orders || []).filter((o) => safeStr(o?.status).toLowerCase() === "fulfilled").length;
  const paid = (orders || []).filter((o) => safeStr(o?.status).toLowerCase() === "paid").length;

  if (loading) return <LoadingShell label="Leyendo órdenes, pagos y envíos..." />;

  if (error) {
    return (
      <EmptyState
        icon={<Shield size={20} />}
        title="No pude cargar el dashboard"
        text={error}
        action={
          <IconButton type="button" onClick={load} className="bg-slate-900 text-white hover:bg-slate-800">
            <RefreshCcw size={16} />
            Reintentar
          </IconButton>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Vista general"
        title="Control operativo en tiempo real"
        text="Aquí ves ventas, pagos, envíos y estado general sin tocar código."
        action={<HelpTip title="Dashboard" text="Este bloque resume lo más importante del negocio con datos reales: ventas, volumen, envíos y actividad reciente." />}
      />

      <FinanceSummary token={token} orgId={orgId} role={role} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={<Package size={20} />}
          label="Pedidos pagados"
          value={String(paid)}
          sub="Listos para seguir flujo"
          tone="blue"
        />
        <MetricCard
          icon={<BadgeCheck size={20} />}
          label="Pedidos enviados"
          value={String(fulfilled)}
          sub="Marcados como fulfilled"
          tone="emerald"
        />
        <MetricCard
          icon={<Activity size={20} />}
          label="Pedidos totales"
          value={String(totalOrders)}
          sub="Ventana actual cargada"
          tone="slate"
        />
        <MetricCard
          icon={<Truck size={20} />}
          label="Envíos"
          value={String(safeNum(enviaSummary?.summary?.shipments_count, 0))}
          sub={enviaSummary?.summary?.last_shipment_at ? `Último: ${shortDateTime(enviaSummary.summary.last_shipment_at)}` : "Sin últimos movimientos"}
          tone="amber"
        />
      </div>
<div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-500">Actividad reciente</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Últimos pedidos</h3>
            </div>
            <div className="text-sm font-black text-slate-900">{compactMoney(totalSales)}</div>
          </div>

          {!orders.length ? (
            <div className="mt-5">
              <EmptyState
                icon={<Package size={20} />}
                title="Todavía no hay pedidos cargados"
                text="Cuando entren ventas reales y estén marcadas como pagadas o enviadas, aparecerán aquí."
              />
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="pb-3 font-black">Pedido</th>
                    <th className="pb-3 font-black">Estado</th>
                    <th className="pb-3 font-black">Monto</th>
                    <th className="pb-3 font-black">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 12).map((o) => {
                    const status = safeStr(o?.status).toLowerCase();
                    const ok = status === "fulfilled";
                    return (
                      <tr key={o.id} className="border-t border-slate-100">
                        <td className="py-4 text-sm font-black text-slate-900">{safeStr(o.id).slice(0, 8)}...</td>
                        <td className="py-4">
                          <span
                            className={clsx(
                              "inline-flex rounded-full px-3 py-1 text-xs font-black",
                              ok ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                            )}
                          >
                            {status || "—"}
                          </span>
                        </td>
                        <td className="py-4 text-sm font-black text-slate-900">{money(o?.amount_total_mxn)}</td>
                        <td className="py-4 text-sm text-slate-500">{shortDateTime(o?.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-500">Lectura rápida</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Salud del sistema</h3>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">Supabase</p>
              <p className="mt-1 text-sm text-slate-500">Conexión activa para auth, órdenes, productos y settings.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">Stripe</p>
              <p className="mt-1 text-sm text-slate-500">Comisiones y pagos listos para leerse desde el panel.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">Envia</p>
              <p className="mt-1 text-sm text-slate-500">Resumen operativo conectado para seguimiento de envíos.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">Permisos</p>
              <p className="mt-1 text-sm text-slate-500">Rol actual detectado: {safeStr(role || "sin rol").toUpperCase()}.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProductsView({ orgId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !orgId) return;
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,price_mxn,stock,section_id,sub_section,rank,image_url,is_active,deleted_at,org_id,organization_id")
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`)
        .is("deleted_at", null)
        .order("rank", { ascending: true })
        .limit(800);

      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = safeStr(q).toLowerCase().trim();
    if (!term) return rows;
    return rows.filter((r) =>
      [r?.name, r?.sku, r?.section_id, r?.sub_section].some((x) => safeStr(x).toLowerCase().includes(term))
    );
  }, [rows, q]);
if (loading) return <LoadingShell label="Leyendo productos reales..." />;

  if (error) {
    return (
      <EmptyState
        icon={<Package size={20} />}
        title="No pude cargar productos"
        text={error}
        action={
          <IconButton type="button" onClick={load} className="bg-slate-900 text-white hover:bg-slate-800">
            <RefreshCcw size={16} />
            Reintentar
          </IconButton>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Catálogo"
        title="Productos conectados"
        text="Vista de catálogo real enlazada a Supabase para revisar precio, stock y estado."
        action={<HelpTip title="Productos" text="Aquí se listan los productos reales detectados para la organización activa. Sirve para revisión rápida sin editar código." />}
      />

      <Card className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, SKU o sección"
              className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <IconButton type="button" onClick={load} className="bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50">
            <RefreshCcw size={16} />
            Actualizar
          </IconButton>
        </div>

        {!filtered.length ? (
          <div className="mt-5">
            <EmptyState
              icon={<Package size={20} />}
              title="No encontré productos"
              text="No hay productos para esta organización o el filtro actual no devolvió resultados."
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 font-black">Producto</th>
                  <th className="pb-3 font-black">SKU</th>
                  <th className="pb-3 font-black">Precio</th>
                  <th className="pb-3 font-black">Stock</th>
                  <th className="pb-3 font-black">Sección</th>
                  <th className="pb-3 font-black">Activo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100 ring-1 ring-slate-200 overflow-hidden shrink-0">
                          {r?.image_url ? (
                            <img src={r.image_url} alt={r?.name || "Producto"} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <Package size={18} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{safeStr(r?.name, "Sin nombre")}</p>
                          <p className="text-xs text-slate-500">Rank: {safeNum(r?.rank, 0)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-sm font-semibold text-slate-600">{safeStr(r?.sku, "—")}</td>
                    <td className="py-4 text-sm font-black text-slate-900">{money(r?.price_mxn)}</td>
                    <td className="py-4 text-sm font-semibold text-slate-600">{safeNum(r?.stock, 0)}</td>
                    <td className="py-4 text-sm font-semibold text-slate-600">
                      {safeStr(r?.section_id, "—")}
                      {r?.sub_section ? ` / ${r.sub_section}` : ""}
                    </td>
                    <td className="py-4">
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-3 py-1 text-xs font-black",
                          r?.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {r?.is_active ? "Sí" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SettingsShortcut() {
  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Ajustes"
        title="Centro de configuración"
        text="Accesos rápidos para editar el comportamiento y el contenido visible de la tienda."
        action={<HelpTip title="Ajustes" text="Desde aquí puedes saltar a páginas de configuración específicas sin tocar archivos manualmente." />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] font-black text-blue-700">Score Store</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Contenido y datos de tienda</h3>
          <p className="mt-2 text-sm text-slate-500">
            Edita hero, contacto, SEO, portada, gallery y nota de footer desde el panel dedicado.
          </p>
          <a
            href="/scorestore-settings"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
          >
            Abrir ajustes
            <ExternalLink size={16} />
          </a>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] font-black text-blue-700">Estado actual</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Producción conectada</h3>
          <p className="mt-2 text-sm text-slate-500">
            El panel ya está enlazado a autenticación, productos, órdenes, pagos y envíos con lectura real.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <HealthPill ok label="Auth" />
            <HealthPill ok label="Store settings" />
            <HealthPill ok label="Orders" />
            <HealthPill ok label="Products" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function UnicOsHomePage() {
  const mounted = useMounted();

  const [checking, setChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activeOrgId, setActiveOrgId] = useState("");
  const [activeOrgName, setActiveOrgName] = useState("");
  const [role, setRole] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currentTab, setCurrentTab] = useState("dashboard");

const loadSessionAndOrg = useCallback(async () => {
    if (!supabase) {
      setGlobalError("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setChecking(false);
      return;
    }

    try {
      setChecking(true);
      setGlobalError("");

      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr) throw sessionErr;

      if (!session?.access_token || !session?.user) {
        setAccessToken("");
        setSessionEmail("");
        setActiveOrgId("");
        setActiveOrgName("");
        setRole("");
        setChecking(false);
        return;
      }

      setAccessToken(session.access_token);

      const token = session.access_token;
      const storedOrg = mounted ? safeStr(window.localStorage.getItem("unicos.org_id"), "") : "";

      const resolveOrg = async () => {
        const whoRes = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const who = await whoRes.json().catch(() => ({}));
        if (!whoRes.ok || !who?.ok) throw new Error(who?.error || "No autorizado.");

        const email = safeStr(who.email || "");
        if (email) setSessionEmail(email);

        const orgs = Array.isArray(who?.organizations) ? who.organizations : [];
        let targetOrg = storedOrg || String(who?.organization_id || "").trim();

        if (!targetOrg && orgs.length) {
          targetOrg = String(orgs[0]?.organization_id || "").trim();
        }

        if (!targetOrg) {
          const { data: rows, error } = await supabase
            .from("admin_users")
            .select("organization_id, org_id, role, is_active, email")
            .eq("is_active", true)
            .ilike("email", email)
            .order("created_at", { ascending: true })
            .limit(10);

          if (error) throw error;
          const row = (rows || []).find((x) => x?.organization_id || x?.org_id);
          targetOrg = row?.organization_id || row?.org_id || "";
          if (!targetOrg) throw new Error("No encontramos una organización ligada a este acceso.");
        }

        let orgName = ORG_LABELS[targetOrg] || "Organización";
        try {
          const { data: orgRow } = await supabase
            .from("organizations")
            .select("id,name")
            .eq("id", targetOrg)
            .limit(1)
            .maybeSingle();
          if (orgRow?.name) orgName = orgRow.name;
        } catch {}

        let adminRow = null;

        const q1 = await supabase
          .from("admin_users")
          .select("id, role, is_active, email, user_id, organization_id, org_id")
          .eq("is_active", true)
          .or(`organization_id.eq.${targetOrg},org_id.eq.${targetOrg}`)
          .or(`email.ilike.${email},user_id.eq.${who.id}`)
          .limit(10);

        if (!q1.error && Array.isArray(q1.data)) {
          adminRow =
            q1.data.find((r) => String(r?.organization_id || r?.org_id || "") === String(targetOrg)) ||
            q1.data[0] ||
            null;
        }

        if (!adminRow?.role) {
          throw new Error("No encontramos permisos activos para esta organización.");
        }

        setActiveOrgId(targetOrg);
        setActiveOrgName(orgName);
        setRole(safeStr(adminRow.role).toLowerCase());
        if (mounted) window.localStorage.setItem("unicos.org_id", targetOrg);
      };

      await resolveOrg();
    } catch (e) {
      setGlobalError(String(e?.message || e));
    } finally {
      setChecking(false);
    }
  }, [mounted]);

  useEffect(() => {
    loadSessionAndOrg();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSessionAndOrg();
    });

    return () => subscription?.unsubscribe?.();
  }, [loadSessionAndOrg]);

  const handleLogin = useCallback(async () => {
    if (!supabase) return;
    try {
      setAuthLoading(true);
      setGlobalError("");

      const email = window.prompt("Escribe tu correo autorizado de UnicOs:");
      if (!email) return;

      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "http://localhost:3000";

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/`,
        },
      });

      if (error) throw error;
      alert("Te mandé tu magic link al correo.");
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
      setAccessToken("");
      setSessionEmail("");
      setActiveOrgId("");
      setActiveOrgName("");
      setRole("");
      setCurrentTab("dashboard");
    } catch (e) {
      setGlobalError(String(e?.message || e));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadSessionAndOrg();
    } finally {
      setRefreshing(false);
    }
  }, [loadSessionAndOrg]);

  const openSettings = useCallback(() => {
    setCurrentTab("settings");
  }, []);

  if (!mounted) return null;

  if (!SUPABASE_READY) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<Shield size={20} />}
            title="Falta configuración pública de Supabase"
            text="Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para que UnicOs pueda operar."
          />
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 md:py-8">
        <div className="mx-auto max-w-7xl">
          <LoadingShell label="Validando acceso, organización y permisos..." />
        </div>
      </div>
    );
  }

  if (!accessToken || !activeOrgId) {
    return <LoginCard onLogin={handleLogin} loading={authLoading} error={globalError} />;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6 space-y-4">
        <TopShell
          orgName={activeOrgName}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onOpenSettings={openSettings}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
        />

        <HeaderBar orgName={activeOrgName} role={role} email={sessionEmail} onLogout={handleLogout} />

        {globalError ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            {globalError}
          </div>
        ) : null}

        {currentTab === "dashboard" ? (
          <DashboardView token={accessToken} orgId={activeOrgId} role={role} />
        ) : null}

        {currentTab === "products" ? <ProductsView orgId={activeOrgId} /> : null}

        {currentTab === "settings" ? <SettingsShortcut /> : null}
      </div>
    </main>
  );
}