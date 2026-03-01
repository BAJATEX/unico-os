/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Megaphone,
  Shield,
  Settings,
  LogOut,
  Search,
  Sparkles,
  Bell,
  Menu,
  ChevronDown,
  X,
  RefreshCcw,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Receipt,
  BadgePercent,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  ExternalLink,
  Boxes,
  Clock,
  Wand2,
  GanttChartSquare,
  FileText,
  Send,
  UserPlus,
  Lock,
  Unlock,
  Calendar,
  Tag,
  Percent,
  Store,
  Activity,
  Zap,
  Flame,
  PiggyBank,
  Wallet,
} from "lucide-react";
import AiDock from "./ai-dock";

import { supabase } from "@/lib/supabase";
import { hasPerm, canManageUsers } from "@/lib/authz";

/* =========================================================
   BRAND
   ========================================================= */

const BRAND = {
  name: "UnicOs",
  grad: "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)",
};

function BrandMark({ size = 44 }) {
  return (
    <div
      className="rounded-2xl flex items-center justify-center text-white font-black"
      style={{ width: size, height: size, background: BRAND.grad }}
    >
      <Image
        src="/logo-unico.png"
        alt="UnicOs"
        width={size - 10}
        height={size - 10}
        priority
        className="object-contain"
      />
    </div>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

const normEmail = (s) => String(s || "").trim().toLowerCase();

const num = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

const moneyMXN = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  try {
    return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  } catch {
    return `$${x.toFixed(2)}`;
  }
};

function BootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-6">
          <Sparkles size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Cargando panel…</h2>
        <p className="text-sm text-slate-500 font-semibold leading-relaxed">
          Preparando permisos, organizaciones y datos.
        </p>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-6">
          UnicOs
        </p>
      </div>
    </div>
  );
}

function EmptyState({ title, desc, actionLabel, onAction }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 font-semibold leading-relaxed">{desc}</p>
        {actionLabel ? (
          <button
            onClick={onAction}
            className="mt-6 px-5 py-3 rounded-2xl text-white font-black shadow-sm"
            style={{ background: BRAND.grad }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((t) => {
    setToast({ ...t, id: Date.now() });
    setTimeout(() => setToast(null), 2600);
  }, []);
  return { toast, show };
}

function Toast({ t }) {
  if (!t) return null;

  const tone =
    t.type === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : t.type === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : t.type === "info"
      ? "bg-sky-50 text-sky-900 border-sky-200"
      : "bg-rose-50 text-rose-900 border-rose-200";

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[99] px-4">
      <div
        className={clsx(
          "max-w-lg w-full border rounded-2xl shadow-xl px-4 py-3 font-bold text-sm",
          tone
        )}
      >
        {t.text}
      </div>
    </div>
  );
}

/* =========================================================
   COMMAND PALETTE (Ctrl/Cmd + K)
   ========================================================= */
function CommandPalette({
  open,
  onClose,
  query,
  setQuery,
  inputRef,
  tabs,
  activeTab,
  setActiveTab,
  results,
  canInvite,
  onOpenAi,
  onRefresh,
}) {
  const q = String(query || "").trim();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const quick = [
    { id: "dashboard", label: "Ir a Finanzas", icon: <LayoutDashboard size={18} /> },
    { id: "orders", label: "Ir a Pedidos", icon: <ShoppingCart size={18} /> },
    { id: "products", label: "Ir a Productos", icon: <Package size={18} /> },
    { id: "crm", label: "Ir a Clientes", icon: <Users size={18} /> },
    { id: "marketing", label: "Ir a Marketing", icon: <Megaphone size={18} /> },
    ...(canInvite
      ? [{ id: "users", label: "Ir a Equipo", icon: <Shield size={18} /> }]
      : []),
    { id: "integrations", label: "Ir a Integraciones", icon: <Settings size={18} /> },
  ].filter((a) => tabs.some((t) => t.id === a.id));

  const go = (id) => {
    if (!tabs.some((t) => t.id === id)) return;
    setActiveTab(id);
    onClose?.();
  };

  const openAi = () => {
    try {
      onOpenAi?.();
    } catch {}
    onClose?.();
  };

  const refresh = () => {
    try {
      onRefresh?.();
    } catch {}
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[95] bg-slate-900/40 backdrop-blur-sm p-4 flex items-start md:items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pedidos o productos…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-600"
            />
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Acciones rápidas
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quick.map((a) => (
              <button
                key={a.id}
                onClick={() => go(a.id)}
                className={clsx(
                  "w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors",
                  activeTab === a.id
                    ? "border-transparent text-white"
                    : "border-slate-200 hover:bg-slate-50"
                )}
                style={activeTab === a.id ? { background: BRAND.grad } : undefined}
              >
                <span className="flex items-center gap-2 font-black">
                  <span className={activeTab === a.id ? "text-white" : "text-slate-500"}>
                    {a.icon}
                  </span>
                  {a.label}
                </span>
                <span
                  className={clsx(
                    "text-xs font-black",
                    activeTab === a.id ? "text-white/80" : "text-slate-400"
                  )}
                >
                  Enter
                </span>
              </button>
            ))}

            <button
              onClick={refresh}
              className="w-full p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 font-black text-slate-900">
                <RefreshCcw size={18} className="text-slate-500" /> Actualizar vista
              </span>
              <span className="text-xs font-black text-slate-400">R</span>
            </button>

            <button
              onClick={openAi}
              className="w-full p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 font-black text-slate-900">
                <Sparkles size={18} className="text-slate-500" /> Abrir IA
              </span>
              <span className="text-xs font-black text-slate-400">I</span>
            </button>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Resultados{q.length >= 2 ? " ·" : ""}{" "}
              <span className="ml-1">
                {q.length >= 2 ? `“${q}”` : "Escribe para buscar"}
              </span>
            </p>

            {q.length < 2 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-600">
                Tip: usa <span className="font-black">Ctrl/⌘ + K</span> en cualquier parte.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Pedidos
                  </p>
                  {results?.orders?.length ? (
                    <div className="space-y-1">
                      {results.orders.map((o) => (
                        <button
                          key={o.id}
                          className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200"
                          onClick={() => go("orders")}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-black text-slate-900">
                              #{String(o.id).split("-")[0].toUpperCase()} {" "}
                              <span className="text-slate-500 font-semibold">
                                • {moneyMXN(o.amount_total_mxn)}
                              </span>
                            </p>
                            <span className="text-xs font-black text-slate-600">
                              {String(o.status || "").toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-500">
                            {o.customer_name || o.email || "—"}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Sin coincidencias.</p>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Productos
                  </p>
                  {results?.products?.length ? (
                    <div className="space-y-1">
                      {results.products.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200"
                          onClick={() => go("products")}
                        >
                          <p className="font-black text-slate-900">{p.name}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            SKU: {p.sku || "—"} • {moneyMXN(p.price_mxn)} • Stock: {num(p.stock)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Sin coincidencias.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 flex items-center justify-between">
          <span>
            <span className="font-black">Ctrl/⌘ + K</span> abrir •{" "}
            <span className="font-black">Esc</span> cerrar
          </span>
          <span className="font-black text-slate-700">UnicOs</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   AUTH GATE
   ========================================================= */

function AuthGate({ onDone }) {
  const { toast, show } = useToast();
  const [state, setState] = useState({ email: "", pass: "", busy: false });

  const signIn = async () => {
    const email = normEmail(state.email);
    const pass = String(state.pass || "");
    if (!email || pass.length < 6) {
      show({ type: "warn", text: "Email y contraseña válidos (mínimo 6 caracteres)." });
      return;
    }

    setState((s) => ({ ...s, busy: true }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
      onDone?.(data?.session || null);
    } catch (e) {
      show({ type: "bad", text: String(e?.message || e) });
    } finally {
      setState((s) => ({ ...s, busy: false }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <BrandMark size={44} />
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight">
              UnicOs Admin
            </h1>
            <p className="text-xs font-semibold text-slate-500">Acceso de administración</p>
          </div>
        </div>

        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">
          Email
        </label>
        <input
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-600"
          placeholder="correo@dominio.com"
        />

        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mt-4 mb-2 block">
          Contraseña
        </label>
        <input
          type="password"
          value={state.pass}
          onChange={(e) => setState((s) => ({ ...s, pass: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-600"
          placeholder="••••••••"
        />

        <button
          onClick={signIn}
          disabled={state.busy}
          className="mt-6 w-full px-5 py-3 rounded-2xl text-white font-black shadow-sm disabled:opacity-60"
          style={{ background: BRAND.grad }}
        >
          {state.busy ? "Entrando…" : "Entrar"}
        </button>

        {toast ? <Toast t={toast} /> : null}
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function AdminPage() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (!session) {
    return <AuthGate onDone={(s) => setSession(s)} />;
  }

  return <Shell session={session} />;
}

/* =========================================================
   SHELL
   ========================================================= */

function Shell({ session }) {
  const { toast, show: toastShow } = useToast();

  const token = session?.access_token || "";
  const userEmail = normEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const [role, setRole] = useState("viewer");
  const [activeTab, setActiveTab] = useState("dashboard");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Search (orders + products)
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState({ orders: [], products: [] });

  // Command Palette
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteInputRef = useRef(null);

  const canInvite = canManageUsers(role);
  const canWrite = ["owner", "admin", "ops"].includes(String(role || "").toLowerCase());

  const openAi = useCallback(() => {
    try {
      const btn = document.querySelector(".ai-fab");
      btn?.click?.();
    } catch {}
  }, []);

  const forceRefresh = useCallback(() => {
    toastShow({ type: "info", text: "Actualizando…" });
    try {
      window.location.reload();
    } catch {}
  }, [toastShow]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: mems, error: memErr } = await supabase
          .from("admin_users")
          .select("organization_id, role, is_active")
          .ilike("email", userEmail)
          .eq("is_active", true);

        if (memErr) throw memErr;

        const orgIds = Array.from(
          new Set((mems || []).map((m) => m.organization_id).filter(Boolean))
        );

        if (!orgIds.length) {
          setOrgs([]);
          setSelectedOrgId(null);
          setRole("viewer");
          return;
        }

        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .in("id", orgIds)
          .order("name");

        if (orgErr) throw orgErr;

        const list = orgData || [];
        setOrgs(list);

        const preferScore = list.find((o) =>
          String(o.slug || o.name || "").toLowerCase().includes("score")
        );
        const pick = preferScore?.id || list?.[0]?.id;

        setSelectedOrgId(pick || null);

        const my = (mems || []).find((m) => String(m.organization_id) === String(pick));
        setRole(String(my?.role || "viewer").toLowerCase());
      } catch (e) {
        console.error(e);
        setOrgs([]);
        setSelectedOrgId(null);
        setRole("viewer");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [userEmail]);

  useEffect(() => {
    (async () => {
      if (!selectedOrgId) return;
      const { data } = await supabase
        .from("admin_users")
        .select("role,is_active")
        .eq("organization_id", selectedOrgId)
        .ilike("email", userEmail)
        .eq("is_active", true)
        .maybeSingle();

      setRole(String(data?.role || "viewer").toLowerCase());
    })();
  }, [selectedOrgId, userEmail]);

  useEffect(() => {
    let alive = true;
    const q = globalQuery.trim();
    if (!q || q.length < 2 || !selectedOrgId) {
      setGlobalResults({ orders: [], products: [] });
      return;
    }

    const t = setTimeout(async () => {
      try {
        const [oRes, pRes] = await Promise.all([
          supabase
            .from("orders")
            .select(
              "id, created_at, customer_name, email, amount_total_mxn, status, stripe_session_id"
            )
            .eq("organization_id", selectedOrgId)
            .or(
              `customer_name.ilike.%${q}%,email.ilike.%${q}%,id.ilike.%${q}%`
            )
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("products")
            .select("id, name, sku, price_mxn, stock, is_active")
            .eq("organization_id", selectedOrgId)
            .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

        if (!alive) return;
        setGlobalResults({ orders: oRes?.data || [], products: pRes?.data || [] });
      } catch {
        if (!alive) return;
        setGlobalResults({ orders: [], products: [] });
      }
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [globalQuery, selectedOrgId]);

  useEffect(() => {
    const onKey = (e) => {
      const k = String(e.key || "").toLowerCase();

      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        setTimeout(() => paletteInputRef.current?.focus?.(), 0);
        return;
      }

      if (paletteOpen) {
        if (k === "i") openAi();
        if (k === "r") forceRefresh();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, openAi, forceRefresh]);

  const signOut = () => supabase.auth.signOut();

  if (loading) return <BootScreen />;

  if (!selectedOrgId) {
    return <BootstrapGate token={token} onSignOut={signOut} />;
  }

  const ALL_TABS = [
    { id: "dashboard", label: "Finanzas", icon: <LayoutDashboard size={20} /> },
    { id: "orders", label: "Pedidos", icon: <ShoppingCart size={20} /> },
    { id: "products", label: "Productos", icon: <Package size={20} /> },
    { id: "crm", label: "Clientes", icon: <Users size={20} /> },
    { id: "marketing", label: "Marketing", icon: <Megaphone size={20} /> },
    { id: "users", label: "Equipo", icon: <Shield size={20} /> },
    { id: "integrations", label: "Integraciones", icon: <Settings size={20} /> },
  ].filter((t) => hasPerm(role, t.id));

  const activeLabel = ALL_TABS.find((t) => t.id === activeTab)?.label || "Panel";

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{
        background:
          "linear-gradient(180deg, rgba(14,165,233,0.06), rgba(20,184,166,0.04) 35%, rgba(248,250,252,1) 100%)",
      }}
    >
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 md:translate-x-0 md:static",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-200 bg-slate-50/70">
          <BrandMark size={44} />
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight truncate">
              UnicOs
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                {role}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-200">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">
            Organización activa
          </label>
          <div className="relative">
            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setActiveTab("dashboard");
                toastShow({ type: "info", text: "Organización actualizada." });
              }}
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-600"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-4 top-3.5 text-slate-400 pointer-events-none"
              size={16}
            />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {ALL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setMobileMenuOpen(false);
              }}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all",
                activeTab === tab.id
                  ? "text-white shadow-lg"
                  : "hover:bg-slate-100 text-slate-700"
              )}
              style={activeTab === tab.id ? { background: BRAND.grad } : undefined}
            >
              <span className={activeTab === tab.id ? "text-white" : "text-slate-400"}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-xs font-black text-slate-700 transition-colors"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="z-20 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900 tracking-tight truncate">
                {activeLabel}
              </h2>
              <p className="text-xs font-semibold text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>

          <div className="relative hidden md:block w-[460px] max-w-[46vw]">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              ref={paletteInputRef}
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onFocus={() => setPaletteOpen(true)}
              placeholder="Buscar… (Ctrl/⌘ + K)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-600"
            />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => {
                setPaletteOpen(true);
                setTimeout(() => paletteInputRef.current?.focus?.(), 0);
              }}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              aria-label="Buscar"
              title="Buscar"
            >
              <Search size={18} />
            </button>

            <button
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <Bell size={18} />
            </button>

            <button
              onClick={openAi}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white font-black text-xs shadow-sm"
              style={{ background: BRAND.grad }}
              title="Unico IA"
            >
              <Sparkles size={16} /> IA
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === "dashboard" && (
              <DashboardView orgId={selectedOrgId} token={token} toast={toastShow} />
            )}

            {activeTab === "orders" && (
              <OrdersAndShippingView
                orgId={selectedOrgId}
                token={token}
                canWrite={canWrite}
                toast={toastShow}
              />
            )}

            {activeTab === "products" && (
              <ProductsView orgId={selectedOrgId} canWrite={canWrite} toast={toastShow} />
            )}

            {activeTab === "crm" && <CRMView orgId={selectedOrgId} />}

            {activeTab === "marketing" && (
              <MarketingView orgId={selectedOrgId} toast={toastShow} />
            )}

            {activeTab === "users" && (
              <UsersView
                orgId={selectedOrgId}
                token={token}
                role={role}
                canInvite={canInvite}
                toast={toastShow}
              />
            )}

            {activeTab === "integrations" && <IntegrationsView token={token} toast={toastShow} />}
          </div>
        </div>

        {toast ? <Toast t={toast} /> : null}

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          query={globalQuery}
          setQuery={setGlobalQuery}
          inputRef={paletteInputRef}
          tabs={ALL_TABS}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          results={globalResults}
          canInvite={canInvite}
          onOpenAi={openAi}
          onRefresh={forceRefresh}
        />

        <AiDock />
      </main>
    </div>
  );
}

/* =========================================================
   ORG BOOTSTRAP (auto-recovery)
   ========================================================= */
function BootstrapGate({ token, onSignOut }) {
  const [state, setState] = useState({ busy: true, error: "" });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) throw new Error(j?.error || "No se pudo activar el acceso.");

        if (alive) window.location.reload();
      } catch (e) {
        if (!alive) return;
        setState({ busy: false, error: String(e?.message || e) });
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  if (state.busy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-6">
            <Sparkles size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Activando acceso…</h2>
          <p className="text-sm text-slate-500 font-semibold leading-relaxed">
            Configurando organizaciones, permisos y seguridad.
          </p>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-5">
            UnicOs
          </p>
        </div>
      </div>
    );
  }

  return (
    <EmptyState
      title="Error: No se encontró la organización."
      desc={
        state.error || "Tu cuenta existe, pero no está vinculada a ninguna organización con acceso admin."
      }
      actionLabel="Salir"
      onAction={onSignOut}
    />
  );
}

/* =========================================================
   DASHBOARD (Stripe + Envía)
   ========================================================= */

function MiniKPI({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300/70 mb-1">
        {label}
      </p>
      <p className="text-lg font-black text-white">{value}</p>
      {note ? <p className="text-xs font-semibold text-slate-300/70 mt-1">{note}</p> : null}
    </div>
  );
}

function DashboardView({ orgId, token, toast }) {
  const [busy, setBusy] = useState(false);

  const [kpi, setKpi] = useState({
    gross: 0,
    net100: 0,
    score70: 0,
    orders: 0,
    avg: 0,
    stripeFee: 0,
    stripeMode: "estimate",
    enviaCost: 0,
    sessions: [],
  });

  const load = useCallback(async () => {
    if (!orgId) return;

    setBusy(true);

    try {
      const { data: paidOrders } = await supabase
        .from("orders")
        .select("id, amount_total_mxn, status, stripe_session_id")
        .eq("organization_id", orgId)
        .in("status", ["paid", "fulfilled"])
        .order("created_at", { ascending: false })
        .limit(400);

      const list = paidOrders || [];

      const gross = list.reduce((a, o) => a + num(o.amount_total_mxn), 0);
      const orders = list.length;
      const avg = orders ? gross / orders : 0;

      const sessions = list.map((o) => o.stripe_session_id).filter(Boolean);

      // Envía costs
      let enviaCost = 0;
      if (sessions.length) {
        const { data: labels } = await supabase
          .from("shipping_labels")
          .select("stripe_session_id, raw")
          .in("stripe_session_id", sessions.slice(0, 200));

        for (const l of labels || []) {
          const raw = l?.raw || {};
          const price = num(raw?.data?.price) || num(raw?.price) || num(raw?.shipment?.price) || 0;
          enviaCost += price;
        }
      }

      // Stripe fees
      let stripeFee = 0;
      let stripeMode = "estimate";

      if (sessions.length) {
        try {
          const res = await fetch("/api/stripe/fees", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ org_id: orgId, stripe_session_ids: sessions.slice(0, 120) }),
          });

          const j = await res.json().catch(() => ({}));

          if (res.ok && j?.ok) {
            stripeFee = num(j.total_fee_mxn);
            stripeMode = "stripe";
          } else {
            throw new Error(j?.error || "fee fail");
          }
        } catch {
          stripeFee = gross * 0.036 + orders * 3;
          stripeMode = "estimate";
        }
      }

      // Neto calculado (100%)
      const net100 = Math.max(0, gross - stripeFee - enviaCost);

      // Reglas internas
      const score70 = Math.max(0, net100 * 0.7);

      setKpi({ gross, net100, score70, orders, avg, stripeFee, stripeMode, enviaCost, sessions });
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }, [orgId, token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-slate-300/90 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-sky-300" /> Ganancia total
            </p>

            <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              {moneyMXN(kpi.score70)}
            </h3>

            <p className="text-sm font-semibold text-slate-300/80 mt-1">
              Bruto − comisión Stripe − costo Envía = Neto.
            </p>
          </div>

          <button
            onClick={load}
            className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-sm flex items-center gap-2"
          >
            <RefreshCcw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 mt-6 border-t border-white/10">
          <MiniKPI label="Ventas brutas" value={moneyMXN(kpi.gross)} />
          <MiniKPI label="Pedidos pagados" value={num(kpi.orders)} />
          <MiniKPI label="Ticket promedio" value={moneyMXN(kpi.avg)} />
          <MiniKPI
            label="Comisión Stripe"
            value={moneyMXN(kpi.stripeFee)}
            note={kpi.stripeMode === "stripe" ? "Real" : "Estimado"}
          />
          <MiniKPI label="Costo Envía" value={moneyMXN(kpi.enviaCost)} />
          <MiniKPI label="Estado" value={busy ? "Cargando…" : "Listo"} />
          <MiniKPI label="Base" value="orders + shipping_labels" />
          <MiniKPI label="Modo" value="multi-org" />
        </div>
      </div>

      <ActivityPanel orgId={orgId} token={token} />
    </div>
  );
}

/* =========================================================
   ACTIVITY / AUDIT
   ========================================================= */

function ActivityPanel({ orgId, token }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;

    setBusy(true);

    try {
      const res = await fetch(`/api/audit/list?org_id=${encodeURIComponent(orgId)}&limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      setRows(res.ok && j?.ok ? j.rows || [] : []);
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
            Actividad
          </p>
          <h4 className="text-lg font-black text-slate-900">Registro de cambios</h4>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
        >
          <RefreshCcw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {rows?.length ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-slate-900 text-sm truncate">
                  {r.action}{" "}
                  <span className="text-slate-500 font-semibold">• {r.entity || "—"}</span>
                </p>
                <p className="text-xs font-bold text-slate-500">
                  {new Date(r.created_at).toLocaleString("es-MX")}
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-1">{r.summary || "—"}</p>
              <p className="text-[11px] font-bold text-slate-500 mt-1">{r.actor_email || "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-500">Sin eventos.</p>
      )}
    </div>
  );
}

/* =========================================================
   ORDERS + SHIPPING
   ========================================================= */

const STATUS_BADGE = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  pending_payment: "bg-amber-50 text-amber-900 border-amber-200",
  paid: "bg-emerald-50 text-emerald-900 border-emerald-200",
  payment_failed: "bg-rose-50 text-rose-900 border-rose-200",
  fulfilled: "bg-sky-50 text-sky-900 border-sky-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  refunded: "bg-purple-50 text-purple-900 border-purple-200",
};

function StatusPill({ status }) {
  const s = String(status || "pending").toLowerCase();
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black",
        STATUS_BADGE[s] || STATUS_BADGE.pending
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {s.toUpperCase()}
    </span>
  );
}

function OrdersAndShippingView({ orgId, token, canWrite, toast }) {
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;

    setBusy(true);

    try {
      const query = q.trim();
      let req = supabase
        .from("orders")
        .select("id, created_at, customer_name, email, amount_total_mxn, status, stripe_session_id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (query.length >= 2) {
        req = req.or(`customer_name.ilike.%${query}%,email.ilike.%${query}%,id.ilike.%${query}%`);
      }

      const { data, error } = await req;
      if (error) throw error;

      setOrders(data || []);
      setSelected(new Set());
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }, [orgId, q, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const bulkUpdate = async (status) => {
    if (!canWrite) return toast?.({ type: "warn", text: "No tienes permisos para editar." });
    const ids = Array.from(selected || []);
    if (!ids.length) return toast?.({ type: "warn", text: "Selecciona pedidos primero." });

    try {
      const res = await fetch("/api/orders/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ org_id: orgId, order_ids: ids, patch: { status } }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "No se pudo actualizar.");

      toast?.({ type: "ok", text: "Pedidos actualizados." });
      await load();
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    }
  };

  const updateOne = async (orderId, status) => {
    if (!canWrite) return toast?.({ type: "warn", text: "No tienes permisos para editar." });

    try {
      const res = await fetch("/api/orders/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ org_id: orgId, order_id: orderId, patch: { status } }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "No se pudo actualizar.");

      toast?.({ type: "ok", text: "Pedido actualizado." });
      await load();
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    }
  };

  const allSelected = selected.size > 0 && orders?.length && selected.size === orders.length;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Operación
            </p>
            <h4 className="text-lg font-black text-slate-900">Pedidos + Envíos</h4>
            <p className="text-sm font-semibold text-slate-600">
              Actualiza estado y gestiona acciones masivas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…"
                className="w-72 max-w-[80vw] pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-black text-slate-800 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-600"
              />
            </div>

            <button
              onClick={load}
              className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
            >
              <RefreshCcw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            disabled={!canWrite}
            onClick={() => bulkUpdate("paid")}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs flex items-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 size={14} className="text-emerald-600" /> Marcar pagados
          </button>

          <button
            disabled={!canWrite}
            onClick={() => bulkUpdate("fulfilled")}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs flex items-center gap-2 disabled:opacity-60"
          >
            <Truck size={14} className="text-sky-600" /> Marcar enviados
          </button>

          <button
            disabled={!canWrite}
            onClick={() => bulkUpdate("cancelled")}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs flex items-center gap-2 disabled:opacity-60"
          >
            <X size={14} className="text-rose-600" /> Cancelar
          </button>

          <span className="ml-auto text-xs font-black text-slate-500">
            Seleccionados: {selected.size}
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="py-2 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={() => {
                      if (selected.size === orders.length) setSelected(new Set());
                      else setSelected(new Set(orders.map((o) => o.id)));
                    }}
                  />
                </th>
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {(orders || []).map((o) => (
                <tr key={o.id} className="border-t border-slate-200">
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                  </td>

                  <td className="py-3 pr-3 font-black text-slate-900">
                    #{String(o.id).split("-")[0].toUpperCase()}
                    <p className="text-xs font-semibold text-slate-500">
                      {o.stripe_session_id ? `Stripe: ${o.stripe_session_id}` : "—"}
                    </p>
                  </td>

                  <td className="py-3 pr-3">
                    <p className="font-black text-slate-900">{o.customer_name || "—"}</p>
                    <p className="text-xs font-semibold text-slate-500">{o.email || "—"}</p>
                  </td>

                  <td className="py-3 pr-3 font-black text-slate-900">{moneyMXN(o.amount_total_mxn)}</td>

                  <td className="py-3 pr-3">
                    <StatusPill status={o.status} />
                  </td>

                  <td className="py-3 pr-3 text-xs font-semibold text-slate-500">
                    {new Date(o.created_at).toLocaleString("es-MX")}
                  </td>

                  <td className="py-3 pr-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        disabled={!canWrite}
                        onClick={() => updateOne(o.id, "fulfilled")}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs disabled:opacity-60"
                        title="Marcar enviado"
                      >
                        <Truck size={14} className="inline mr-1 text-sky-600" /> Enviado
                      </button>

                      <button
                        disabled={!canWrite}
                        onClick={() => updateOne(o.id, "refunded")}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs disabled:opacity-60"
                        title="Reembolso"
                      >
                        <ArrowDownRight size={14} className="inline mr-1 text-purple-600" /> Refund
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!orders?.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm font-semibold text-slate-500">
                    Sin pedidos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PRODUCTS (simple)
   ========================================================= */

function ProductsView({ orgId, canWrite, toast }) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (!orgId) return;

    setBusy(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, price_mxn, stock, is_active, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
            Catálogo
          </p>
          <h4 className="text-lg font-black text-slate-900">Productos</h4>
          <p className="text-sm font-semibold text-slate-600">
            Vista rápida (gestión avanzada puede ir en módulo aparte).
          </p>
        </div>

        <button
          onClick={load}
          className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
        >
          <RefreshCcw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
              <th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Precio</th>
              <th className="py-2 pr-3">Stock</th>
              <th className="py-2 pr-3">Estado</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {(rows || []).map((p) => (
              <tr key={p.id} className="border-t border-slate-200">
                <td className="py-3 pr-3 font-black text-slate-900">{p.name}</td>
                <td className="py-3 pr-3 font-semibold text-slate-600">{p.sku || "—"}</td>
                <td className="py-3 pr-3 font-black text-slate-900">{moneyMXN(p.price_mxn)}</td>
                <td className="py-3 pr-3 font-black text-slate-900">{num(p.stock)}</td>
                <td className="py-3 pr-3">
                  <span
                    className={clsx(
                      "inline-flex items-center px-3 py-1 rounded-full border text-xs font-black",
                      p.is_active
                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    {p.is_active ? "ACTIVO" : "INACTIVO"}
                  </span>
                </td>
              </tr>
            ))}

            {!rows?.length ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm font-semibold text-slate-500">
                  Sin productos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!canWrite ? (
        <p className="text-xs font-semibold text-slate-500 mt-4">
          Nota: tu rol actual es solo lectura.
        </p>
      ) : null}
    </div>
  );
}

/* =========================================================
   CRM / MARKETING / USERS / INTEGRATIONS
   ========================================================= */

function CRMView() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <h4 className="text-lg font-black text-slate-900">Clientes</h4>
      <p className="text-sm font-semibold text-slate-600 mt-1">Módulo listo para crecer.</p>
    </div>
  );
}

function MarketingView() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <h4 className="text-lg font-black text-slate-900">Marketing</h4>
      <p className="text-sm font-semibold text-slate-600 mt-1">Módulo listo para crecer.</p>
    </div>
  );
}

function UsersView() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <h4 className="text-lg font-black text-slate-900">Equipo</h4>
      <p className="text-sm font-semibold text-slate-600 mt-1">
        Invitaciones y roles se manejan por API.
      </p>
    </div>
  );
}

function IntegrationsView() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <h4 className="text-lg font-black text-slate-900">Integraciones</h4>
      <p className="text-sm font-semibold text-slate-600 mt-1">Stripe / Supabase / Envía.</p>
    </div>
  );
}