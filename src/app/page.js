"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hasPerm, canManageUsers, ROLE_PERMS } from "@/lib/authz";
import {
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  LogOut,
  ChevronDown,
  Plus,
  Search,
  X,
  HelpCircle,
  Info,
  Megaphone,
  Bell,
  Menu,
  Shield
} from "lucide-react";

/** Formateador de moneda MXN */
function moneyMXN(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

/* =========================================================================================
   COMPONENTE PRINCIPAL (ENTRY POINT)
   ========================================================================================= */
export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let unsub = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);

      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s || null);
      });
      unsub = sub?.subscription;

      setLoading(false);
    })();

    return () => {
      if (unsub) unsub.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;

  return <AdminDashboard />;
}

/* =========================================================================================
   LOGIN SCREEN
   ========================================================================================= */
function LoginScreen() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    try {
      if (!email || !password) {
        setMsg("Ingresa email y contraseña.");
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Cuenta creada. Revisa tu correo si tu proyecto requiere verificación.");
      }
    } catch (err) {
      setMsg(err?.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-unico-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-red-200">
              U
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                ÚNICO <span className="text-unico-600">OS</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Commander · Secure Login
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
            <input
              className="mt-2 w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl outline-none font-semibold"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="tu@email.com"
              type="email"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Contraseña</label>
            <input
              className="mt-2 w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl outline-none font-semibold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {msg ? <div className="text-sm font-semibold text-unico-600">{msg}</div> : null}

          <button
            disabled={busy}
            className="w-full bg-unico-600 hover:bg-unico-700 text-white font-extrabold py-4 rounded-2xl shadow-lg disabled:opacity-60"
          >
            {busy ? "Procesando..." : mode === "login" ? "ENTRAR" : "CREAR CUENTA"}
          </button>

          <button
            type="button"
            className="w-full text-sm font-bold text-slate-500 hover:text-unico-600"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
          </button>

          <p className="text-xs text-slate-400 leading-relaxed">
            Recomendado: habilitar RLS y memberships. Sin eso, un panel multi-tenant no es seguro.
          </p>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================================
   DASHBOARD LAYOUT & LOGIC
   ========================================================================================= */
function AdminDashboard() {
  const [orgs, setOrgs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const [helpMsg, setHelpMsg] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // anti-spam notifications
  const lastNotifyRef = useRef({ lowStockAt: 0, paidOrdersAt: 0 });

  const selectedMembership = useMemo(
    () => memberships.find((m) => String(m.org_id) === String(selectedOrgId)) || null,
    [memberships, selectedOrgId]
  );

  const selectedOrg = useMemo(
    () => orgs.find((o) => String(o.id) === String(selectedOrgId)) || null,
    [orgs, selectedOrgId]
  );

  const role = selectedMembership?.role || "viewer";

  const allowedTabs = useMemo(() => {
    const list = ROLE_PERMS[(role || "viewer").toLowerCase()] || ROLE_PERMS.viewer;
    return list;
  }, [role]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) return;

        // ✅ MULTITENANT: solo orgs donde el usuario tiene membership
        const { data: mems, error: memErr } = await supabase
          .from("org_memberships")
          .select("org_id, role")
          .eq("user_id", user.id);

        if (memErr) throw memErr;

        const orgIds = (mems || []).map((m) => m.org_id).filter(Boolean);
        setMemberships(mems || []);

        if (!orgIds.length) {
          setOrgs([]);
          setSelectedOrgId(null);
          return;
        }

        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .select("*")
          .in("id", orgIds)
          .order("name", { ascending: true });

        if (orgErr) throw orgErr;

        setOrgs(orgData || []);
        const preferred = (orgData || []).find((o) => o.slug === "score-store");
        setSelectedOrgId(preferred?.id || orgData?.[0]?.id || null);

        if ("Notification" in window && Notification.permission === "granted") {
          setNotificationsEnabled(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Asegura que activeTab siempre sea permitido por rol
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] || "dashboard");
    }
  }, [allowedTabs, activeTab]);

  // SCANNER DE ALERTAS (solo para roles con ops/orders/products)
  useEffect(() => {
    if (!selectedOrgId || !notificationsEnabled) return;
    if (!hasPerm(role, "orders") && !hasPerm(role, "products")) return;

    const COOLDOWN = 10 * 60 * 1000; // 10 min

    const runScanner = async () => {
      try {
        const now = Date.now();

        if (hasPerm(role, "products") && now - lastNotifyRef.current.lowStockAt > COOLDOWN) {
          const { data: lowStock } = await supabase
            .from("products")
            .select("name, stock")
            .eq("org_id", selectedOrgId)
            .not("stock", "is", null)
            .lt("stock", 5)
            .order("stock", { ascending: true })
            .limit(1);

          if (lowStock && lowStock.length > 0) {
            new Notification("⚠️ STOCK BAJO", {
              body: `${lowStock[0].name}: Quedan ${lowStock[0].stock}`,
              icon: "/icon-192.png"
            });
            lastNotifyRef.current.lowStockAt = now;
          }
        }

        if (hasPerm(role, "orders") && now - lastNotifyRef.current.paidOrdersAt > COOLDOWN) {
          const { count } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("org_id", selectedOrgId)
            .eq("status", "paid");

          if (typeof count === "number" && count > 0) {
            new Notification("💰 PEDIDOS POR ENVIAR", {
              body: `Tienes ${count} pedidos pagados por procesar.`,
              icon: "/icon-192.png"
            });
            lastNotifyRef.current.paidOrdersAt = now;
          }
        }
      } catch (e) {
        // Silencioso
      }
    };

    runScanner();
    const interval = setInterval(runScanner, 300000);
    return () => clearInterval(interval);
  }, [selectedOrgId, notificationsEnabled, role]);

  const requestNotify = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") setNotificationsEnabled(true);
  };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <LoadingScreen />;
  if (!selectedOrgId || !selectedOrg) return <EmptyStateMultiTenant />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
          md:translate-x-0 md:static md:shadow-sm
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-unico-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-200">
              U
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                ÚNICO <span className="text-unico-600">OS</span>
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Commander</p>
                <span className="text-[10px] font-extrabold text-slate-300">·</span>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{role}</p>
              </div>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="px-6 mt-6">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Organización:</label>
          <div className="relative group">
            <select
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 outline-none"
              value={selectedOrgId || ""}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-8 overflow-y-auto">
          {hasPerm(role, "dashboard") && (
            <NavBtn
              icon={<LayoutDashboard size={20} />}
              label="Reporte Financiero"
              active={activeTab === "dashboard"}
              onClick={() => handleNavClick("dashboard")}
            />
          )}
          {hasPerm(role, "orders") && (
            <NavBtn
              icon={<ShoppingCart size={20} />}
              label="Pedidos y Guías"
              active={activeTab === "orders"}
              onClick={() => handleNavClick("orders")}
            />
          )}
          {hasPerm(role, "products") && (
            <NavBtn
              icon={<Package size={20} />}
              label="Inventario (Fotos)"
              active={activeTab === "products"}
              onClick={() => handleNavClick("products")}
            />
          )}
          {hasPerm(role, "marketing") && (
            <NavBtn
              icon={<Megaphone size={20} />}
              label="Marketing & Ofertas"
              active={activeTab === "marketing"}
              onClick={() => handleNavClick("marketing")}
            />
          )}
          {hasPerm(role, "settings") && (
            <NavBtn
              icon={<Settings size={20} />}
              label="Configuración Web"
              active={activeTab === "settings"}
              onClick={() => handleNavClick("settings")}
            />
          )}
          {hasPerm(role, "users") && (
            <NavBtn
              icon={<Shield size={20} />}
              label="Usuarios y Permisos"
              active={activeTab === "users"}
              onClick={() => handleNavClick("users")}
            />
          )}
        </nav>

        <div className="p-6 mt-auto">
          {!notificationsEnabled && (
            <button
              onClick={requestNotify}
              className="mb-4 flex items-center gap-3 text-xs font-bold text-unico-600 bg-red-50 w-full px-4 py-3 rounded-xl hover:bg-red-100"
            >
              <Bell size={16} /> Activar Alertas
            </button>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 text-sm font-medium text-slate-500 hover:text-slate-800 w-full px-4 py-3 rounded-xl hover:bg-slate-50"
          >
            <LogOut size={18} /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-slate-50/50 w-full">
        <header className="bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>

            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight truncate max-w-[240px] md:max-w-none">
                {activeTab === "dashboard" && "Reporte Financiero"}
                {activeTab === "marketing" && "Marketing"}
                {activeTab === "orders" && "Logística"}
                {activeTab === "products" && "Inventario"}
                {activeTab === "settings" && "Ajustes"}
                {activeTab === "users" && "Usuarios y Permisos"}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mt-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="hidden md:inline">{selectedOrg.name.toUpperCase()}</span>
                <span className="md:hidden">ONLINE</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32">
          {activeTab === "dashboard" && <DashboardView orgId={selectedOrgId} setHelp={setHelpMsg} />}
          {activeTab === "orders" && <OrdersView orgId={selectedOrgId} setHelp={setHelpMsg} role={role} />}
          {activeTab === "products" && <ProductsView orgId={selectedOrgId} setHelp={setHelpMsg} role={role} />}
          {activeTab === "marketing" && <MarketingView orgId={selectedOrgId} setHelp={setHelpMsg} role={role} />}
          {activeTab === "settings" && <SettingsView orgId={selectedOrgId} setHelp={setHelpMsg} role={role} />}
          {activeTab === "users" && <UsersView orgId={selectedOrgId} setHelp={setHelpMsg} role={role} />}
        </div>
      </main>

      {helpMsg && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-sm bg-slate-900 text-white p-5 rounded-2xl shadow-2xl z-50 flex gap-4 items-start">
          <Info className="text-unico-600 shrink-0 mt-1" size={24} />
          <div>
            <h4 className="font-bold text-sm mb-1 text-unico-100">Ayuda Rápida</h4>
            <p className="text-sm leading-relaxed opacity-90">{helpMsg}</p>
            <button onClick={() => setHelpMsg(null)} className="text-xs font-bold mt-3 hover:text-unico-600 underline">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
   VIEWS (DASHBOARD, PRODUCTS, ORDERS, ETC)
   ========================================================================================= */
///** DASHBOARD VIEW */
function DashboardView({ orgId, setHelp }) {
  const [finance, setFinance] = useState({
    gross: 0,
    shipping: 0,
    stripeFees: 0,
    net: 0,
    orders: 0
  });

  useEffect(() => {
    async function load() {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("total, shipping_cost, stripe_fee, status")
        .eq("org_id", orgId)
        .eq("status", "paid");

      if (error) return;

      let gross = 0;
      let shipping = 0;
      let stripeFees = 0;

      (orders || []).forEach((o) => {
        const t = Number(o.total || 0);
        gross += t;
        shipping += Number(o.shipping_cost || 0);
        stripeFees += Number(o.stripe_fee || 0);
      });

      const net = Math.max(0, gross - shipping - stripeFees);

      setFinance({
        orders: orders?.length || 0,
        gross,
        shipping,
        stripeFees,
        net
      });
    }

    load();
  }, [orgId]);

  const getPct = (val, total) => (total > 0 ? ((val / total) * 100).toFixed(1) : "0.0");

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-unico-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest">UTILIDAD NETA</p>
            <button onClick={() => setHelp("Neto = Total pagado - envío - fees (si tu DB los guarda).")}>
              <HelpCircle className="text-slate-500 hover:text-white" />
            </button>
          </div>

          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            {moneyMXN(finance.net)} <span className="text-lg text-green-400 font-medium">MXN</span>
          </h2>

          <div className="grid grid-cols-3 gap-2 md:gap-4 pt-6 border-t border-slate-700 text-xs md:text-sm">
            <div>
              <p className="text-slate-400 text-[10px] uppercase mb-1">VENTAS TOTALES</p>
              <p className="font-bold">{moneyMXN(finance.gross)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase mb-1">
                STRIPE FEES ({getPct(finance.stripeFees, finance.gross)}%)
              </p>
              <p className="font-bold text-red-400">-{moneyMXN(finance.stripeFees)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase mb-1">
                ENVÍOS ({getPct(finance.shipping, finance.gross)}%)
              </p>
              <p className="font-bold text-orange-400">-{moneyMXN(finance.shipping)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase">Pedidos Pagados</p>
            <p className="text-2xl font-black text-slate-800">{finance.orders}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase">Ticket Promedio</p>
            <p className="text-2xl font-black text-slate-800">
              {finance.orders > 0 ? moneyMXN(finance.gross / finance.orders) : moneyMXN(0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** PRODUCTS VIEW */
function ProductsView({ orgId, setHelp, role }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProducts(data || []));
  }, [orgId, refresh]);

  const canWrite = ["owner", "admin", "ops"].includes(String(role || "").toLowerCase()) && hasPerm(role, "products");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return products;
    return (products || []).filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      const cat = String(p.category || "").toLowerCase();
      return name.includes(query) || sku.includes(query) || cat.includes(query);
    });
  }, [products, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, SKU o categoría..."
            className="outline-none text-sm w-full md:w-80 bg-transparent"
          />
        </div>

        {canWrite && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-unico-600 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 w-full md:w-auto justify-center shadow-lg hover:bg-unico-700"
          >
            <Plus size={18} /> Nuevo Producto
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Foto</th>
              <th className="px-6 py-4">Nombre</th>
              <th className="px-6 py-4">Precio</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <img
                    src={p.image_url || "/icon-192.png"}
                    className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                    alt=""
                  />
                </td>
                <td className="px-6 py-4 font-bold text-slate-800">
                  {p.name}
                  <br />
                  <span className="text-xs font-normal text-slate-400">{p.category || "—"}</span>
                </td>
                <td className="px-6 py-4 font-mono text-slate-700">{moneyMXN(p.price)}</td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                      Number(p.stock ?? 0) <= 5 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700"
                    }`}
                    title="Stock"
                  >
                    {Number(p.stock ?? 0)}
                  </span>
                </td>

                <td className="px-6 py-4 font-mono text-slate-500">{p.sku || "—"}</td>

                <td className="px-6 py-4 text-right">
                  <span
                    className={`text-xs font-extrabold px-2 py-1 rounded-lg ${
                      p.active ? "text-green-700 bg-green-50" : "text-slate-600 bg-slate-100"
                    }`}
                  >
                    {p.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No hay resultados.</div>
        ) : null}
      </div>

      {showModal && (
        <CreateProductModal
          orgId={orgId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            setRefresh((p) => p + 1);
          }}
          setHelp={setHelp}
        />
      )}
    </div>
  );
}

function CreateProductModal({ orgId, onClose, onSuccess, setHelp }) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "100",
    category: "BAJA_1000",
    sku: ""
  });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) setImageFile(e.target.files[0]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setErr("");

    try {
      if (!form.name || !form.price) {
        setErr("Nombre y precio son obligatorios.");
        return;
      }

      let finalImageUrl = "/icon-192.png";

      if (imageFile) {
        const cleanName = String(imageFile.name || "img")
          .trim()
          .replace(/[^\w.\-]+/g, "-")
          .replace(/\-+/g, "-")
          .slice(0, 120);

        const fileName = `${orgId}/${Date.now()}-${cleanName}`;

        const { error: upErr } = await supabase.storage.from("products").upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false
        });
        if (upErr) throw upErr;

        const { data } = supabase.storage.from("products").getPublicUrl(fileName);
        finalImageUrl = data?.publicUrl || finalImageUrl;
      }

      const payload = {
        org_id: orgId,
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock || 0),
        category: form.category,
        sku: form.sku || null,
        image_url: finalImageUrl,
        active: true
      };

      const { error: insErr } = await supabase.from("products").insert(payload);
      if (insErr) throw insErr;

      onSuccess();
    } catch (e2) {
      setErr(e2?.message || "Error al guardar.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-extrabold text-lg text-slate-800">Alta de Producto</h3>
            <p className="text-xs text-slate-500 font-semibold">Se guarda dentro de la org seleccionada.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-8 space-y-6">
          <div>
            <label className="text-sm font-extrabold text-slate-800 block mb-2">Foto del Producto</label>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-all relative">
              <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              {imageFile ? (
                <div className="text-green-700 font-extrabold flex items-center gap-2 text-sm">
                  <CheckCircle size={16} /> {imageFile.name}
                </div>
              ) : (
                <>
                  <Upload className="text-slate-400 mb-2" size={32} />
                  <span className="text-sm text-slate-500 font-semibold">Toca para subir foto</span>
                </>
              )}
            </div>
          </div>

          <FormInput
            label="Nombre"
            placeholder="Ej. Hoodie 2026"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            onHelp={() => setHelp("Nombre público del producto (se mostrará en tienda).")}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Precio (MXN)"
              placeholder="0.00"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              onHelp={() => setHelp("Precio final en MXN.")}
              isCode
            />
            <FormInput
              label="Stock"
              placeholder="100"
              value={form.stock}
              onChange={(v) => setForm({ ...form, stock: v })}
              onHelp={() => setHelp("Cantidad disponible (para alertas de stock).")}
              isCode
            />
          </div>

          <FormInput
            label="SKU"
            placeholder="Ej. B1K-HOOD-2026"
            value={form.sku}
            onChange={(v) => setForm({ ...form, sku: v })}
            onHelp={() => setHelp("SKU interno. Opcional pero recomendado para logística.")}
            isCode
          />

          <div>
            <label className="text-sm font-extrabold text-slate-800 block mb-2">Categoría</label>
            <div className="relative">
              <select
                className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-unico-600/20 focus:border-unico-600"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="BAJA_1000">Baja 1000</option>
                <option value="BAJA_500">Baja 500</option>
                <option value="BAJA_400">Baja 400</option>
                <option value="SF_250">San Felipe 250</option>
              </select>
              <ChevronDown className="absolute right-4 top-4 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          {err ? <div className="text-sm font-bold text-red-600 bg-red-50 p-3 rounded-2xl">{err}</div> : null}

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-unico-600 hover:bg-unico-700 text-white font-extrabold py-4 rounded-2xl shadow-lg disabled:opacity-60"
          >
            {uploading ? "Guardando..." : "GUARDAR"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** ORDERS VIEW */
function OrdersView({ orgId, setHelp, role }) {
  const [orders, setOrders] = useState([]);
  const [refresh, setRefresh] = useState(0);

  const roleNorm = String(role || "").toLowerCase();
  const canWrite = ["owner", "admin", "ops", "sales"].includes(roleNorm) && hasPerm(role, "orders");

  useEffect(() => {
    supabase
      .from("orders")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data || []));
  }, [orgId, refresh]);

  const sendWhatsApp = (order) => {
    const phone = String(order?.phone || "").replace(/[^\d]/g, "");
    const msg = `Hola ${order?.customer_name || ""} 👋\nTu pedido #${String(order?.id || "")
      .slice(0, 6)
      .toUpperCase()} está en proceso.\n\nTracking: ${order?.tracking_number || "pendiente"}`;

    if (!phone) return alert("Este pedido no tiene teléfono.");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  async function getRequesterUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }

  const updateTracking = async (order) => {
    if (!canWrite) return;

    const guide = prompt("Número de guía / tracking:", order?.tracking_number || "");
    if (!guide) return;

    const requester_user_id = await getRequesterUserId();
    if (!requester_user_id) return alert("Sesión inválida. Vuelve a entrar.");

    const res = await fetch("/api/orders/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        requester_user_id,
        order_id: order.id,
        patch: { tracking_number: guide, status: "shipped" }
      })
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error || "Error al actualizar.");

    setRefresh((p) => p + 1);
    alert("Guardado");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-800">Pedidos</h3>
          <p className="text-xs text-slate-500 font-semibold">Pagados / Enviados por organización.</p>
        </div>
        <button onClick={() => setHelp("Aquí ves pedidos y tracking. Ops/Sales pueden actualizar guías (vía endpoint server).")}>
          <HelpCircle className="text-slate-300 hover:text-unico-600" />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <p className="text-slate-500 font-semibold">Sin pedidos.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="min-w-0">
                <p className="font-extrabold text-slate-800">
                  #{String(order.id).slice(0, 6).toUpperCase()}{" "}
                  <span className="text-xs font-bold text-slate-400">· {order.status || "—"}</span>
                </p>
                <p className="text-sm text-slate-500 font-semibold truncate">{order.customer_email || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-700">Total: {moneyMXN(order.total)}</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-700">
                    Envío: {moneyMXN(order.shipping_cost)}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-700">
                    Tracking: {order.tracking_number || "pendiente"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={() => sendWhatsApp(order)}
                  className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-2xl font-extrabold text-xs"
                >
                  WhatsApp
                </button>

                {canWrite && order.status !== "shipped" ? (
                  <button
                    onClick={() => updateTracking(order)}
                    className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-2xl font-extrabold text-xs"
                  >
                    Cargar Guía
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** MARKETING VIEW */
function MarketingView({ orgId, setHelp, role }) {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);

  const roleNorm = String(role || "").toLowerCase();
  const canWrite = ["owner", "admin", "marketing"].includes(roleNorm) && hasPerm(role, "marketing");

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("*")
      .eq("org_id", orgId)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data);
      });
  }, [orgId]);

  const handleSave = async () => {
    if (!canWrite) return;
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert({ ...config, org_id: orgId });
    setSaving(false);
    if (error) return alert(error.message);
    alert("Oferta publicada.");
  };

  return (
    <div className="max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800">Cintillo de Ofertas</h3>
          <p className="text-xs text-slate-500 font-semibold">Controla promo, texto y mensajes de marketing.</p>
        </div>
        <button onClick={() => setHelp("Esto impacta el banner/promo en la web (si la web lo consume).")} className="text-unico-600">
          <HelpCircle size={20} />
        </button>
      </div>

      <div className="space-y-6">
        <div
          className={`p-4 rounded-2xl border-2 transition-all ${
            config.promo_active ? "border-green-500 bg-green-50" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-700">Estado de la Promoción</span>
            <label className={`relative inline-flex items-center cursor-pointer ${!canWrite ? "opacity-60 pointer-events-none" : ""}`}>
              <input
                type="checkbox"
                checked={!!config.promo_active}
                onChange={(e) => setConfig({ ...config, promo_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600" />
            </label>
          </div>
        </div>

        <FormInput
          label="Texto de la Oferta"
          placeholder="Ej. ¡ENVÍO GRATIS!"
          value={config.promo_text}
          onChange={(v) => setConfig({ ...config, promo_text: v })}
          onHelp={() => setHelp("Texto del cintillo superior.")}
          disabled={!canWrite}
        />

        <button
          onClick={handleSave}
          disabled={!canWrite || saving}
          className="w-full bg-unico-600 hover:bg-unico-700 text-white font-extrabold py-4 rounded-2xl shadow-md disabled:opacity-60"
        >
          {saving ? "Publicando..." : canWrite ? "PUBLICAR OFERTA" : "Solo lectura"}
        </button>
      </div>
    </div>
  );
}

/** SETTINGS VIEW */
function SettingsView({ orgId, setHelp, role }) {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);

  const roleNorm = String(role || "").toLowerCase();
  const canWrite = ["owner", "admin", "marketing"].includes(roleNorm) && hasPerm(role, "settings");

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("*")
      .eq("org_id", orgId)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data);
      });
  }, [orgId]);

  const handleSave = async () => {
    if (!canWrite) return;
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert({ ...config, org_id: orgId });
    setSaving(false);
    if (error) return alert(error.message);
    alert("Guardado");
  };

  return (
    <div className="max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800">Ajustes Web</h3>
          <p className="text-xs text-slate-500 font-semibold">Contenido del hero, pixel, etc.</p>
        </div>
        <button onClick={() => setHelp("Estos settings los lee tu web pública si los conectas en main.js / API.")}>
          <HelpCircle className="text-slate-300 hover:text-unico-600" />
        </button>
      </div>

      <div className="space-y-6">
        <FormInput
          label="Título Portada (Hero)"
          value={config.hero_title}
          onChange={(v) => setConfig({ ...config, hero_title: v })}
          placeholder="Ej. NUEVA COLECCIÓN"
          disabled={!canWrite}
        />

        <FormInput
          label="Pixel Facebook"
          value={config.pixel_id}
          onChange={(v) => setConfig({ ...config, pixel_id: v })}
          placeholder="Ej. 1234567890"
          isCode
          disabled={!canWrite}
        />

        <button
          onClick={handleSave}
          disabled={!canWrite || saving}
          className="w-full bg-unico-600 hover:bg-unico-700 text-white font-extrabold py-4 rounded-2xl shadow-md disabled:opacity-60"
        >
          {saving ? "Guardando..." : canWrite ? "GUARDAR" : "Solo lectura"}
        </button>
      </div>
    </div>
  );
}

/** USERS VIEW */
function UsersView({ orgId, setHelp, role }) {
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("sales");
  const [refresh, setRefresh] = useState(0);

  const canManage = canManageUsers(role);

  useEffect(() => {
    supabase
      .from("org_memberships")
      .select("user_id, role, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMembers(data || []));
  }, [orgId, refresh]);

  async function getRequesterUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }

  const invite = async () => {
    if (!canManage) return;
    if (!inviteEmail) return alert("Escribe un email.");
    setBusy(true);

    try {
      const requester_user_id = await getRequesterUserId();
      if (!requester_user_id) return alert("Sesión inválida. Vuelve a entrar.");

      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          email: inviteEmail,
          role: inviteRole,
          requester_user_id
        })
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) return alert(j?.error || "Error al invitar.");

      setInviteEmail("");
      setInviteRole("sales");
      setRefresh((p) => p + 1);
      alert("Invitación enviada / usuario creado.");
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (user_id) => {
    if (!canManage) return;
    const next = prompt("Nuevo rol (owner/admin/ops/sales/marketing/viewer):", "sales");
    if (!next) return;

    await supabase.from("org_memberships").update({ role: next }).eq("org_id", orgId).eq("user_id", user_id);
    setRefresh((p) => p + 1);
  };

  const removeMember = async (user_id) => {
    if (!canManage) return;
    if (!confirm("¿Quitar acceso a esta organización?")) return;

    await supabase.from("org_memberships").delete().eq("org_id", orgId).eq("user_id", user_id);
    setRefresh((p) => p + 1);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-800">Usuarios y Permisos</h3>
            <p className="text-xs text-slate-500 font-semibold">Roles por organización (multitenant real).</p>
          </div>
          <button onClick={() => setHelp("Owner/Admin pueden administrar roles. Invite se ejecuta server-side con Service Role.")}>
            <HelpCircle className="text-slate-300 hover:text-unico-600" />
          </button>
        </div>

        <div className={`mt-6 p-4 rounded-2xl border ${canManage ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-slate-50 opacity-70"}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value.trim())}
              placeholder="email@empresa.com"
              className="w-full border border-slate-200 bg-white p-4 rounded-2xl outline-none font-semibold"
              disabled={!canManage}
            />
            <div className="relative">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full appearance-none border border-slate-200 bg-white p-4 rounded-2xl outline-none font-extrabold text-slate-700"
                disabled={!canManage}
              >
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="ops">ops</option>
                <option value="sales">sales</option>
                <option value="marketing">marketing</option>
                <option value="viewer">viewer</option>
              </select>
              <ChevronDown className="absolute right-4 top-4 text-slate-400 pointer-events-none" size={16} />
            </div>
            <button
              onClick={invite}
              disabled={!canManage || busy}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl px-4 py-4 disabled:opacity-60"
            >
              {busy ? "..." : "Invitar / Crear"}
            </button>
          </div>

          {!canManage ? (
            <p className="mt-3 text-xs text-slate-500 font-semibold">
              Solo <b>owner/admin</b> pueden administrar accesos.
            </p>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <p className="text-sm font-extrabold text-slate-700">Miembros</p>
          <span className="text-xs font-bold text-slate-500">{members.length} total</span>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((m) => (
            <div key={`${m.user_id}`} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-extrabold text-slate-800 truncate">{m.user_id}</p>
                <p className="text-xs text-slate-500 font-semibold">Rol: {m.role}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => updateRole(m.user_id)}
                  disabled={!canManage}
                  className="px-4 py-2 rounded-2xl text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Cambiar rol
                </button>
                <button
                  onClick={() => removeMember(m.user_id)}
                  disabled={!canManage}
                  className="px-4 py-2 rounded-2xl text-xs font-extrabold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}

          {members.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No hay miembros (org_memberships vacío).</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   UI HELPERS
   ========================================================================================= */

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-extrabold transition-all group ${
        active ? "bg-unico-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50 hover:text-unico-600"
      }`}
    >
      <span className={active ? "text-white" : "text-slate-400 group-hover:text-unico-600"}>{icon}</span>
      {label}
    </button>
  );
}

function FormInput({ label, desc, value, onChange, placeholder, isCode, onHelp, disabled }) {
  return (
    <div className={`relative ${disabled ? "opacity-70" : ""}`}>
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-sm font-extrabold text-slate-800">{label}</label>
        {onHelp ? (
          <button type="button" onClick={onHelp} className="text-xs text-unico-600 font-extrabold hover:underline flex items-center gap-1">
            <HelpCircle size={12} /> Ayuda
          </button>
        ) : null}
      </div>
      <input
        className={`w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl focus:ring-2 focus:ring-unico-600/20 focus:border-unico-600 outline-none text-slate-700 font-extrabold ${
          isCode ? "font-mono" : ""
        }`}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {desc ? <p className="text-xs text-slate-400 mt-2 ml-1">{desc}</p> : null}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
      <div className="h-16 w-16 bg-unico-600 rounded-3xl animate-pulse flex items-center justify-center shadow-xl mb-6">
        <span className="text-white font-black text-2xl">U</span>
      </div>
      <p className="text-sm font-extrabold tracking-widest text-slate-400">CARGANDO...</p>
    </div>
  );
}

function EmptyStateMultiTenant() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-6 text-center">
        <div className="mx-auto h-14 w-14 rounded-3xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl mb-4">
          !
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">Sin organizaciones asignadas</h2>
        <p className="text-sm text-slate-500 font-semibold mt-2">
          Tu usuario no tiene registros en <span className="font-mono">org_memberships</span>. Necesitas que owner/admin te agregue a una organización.
        </p>
      </div>
    </div>
  );
}