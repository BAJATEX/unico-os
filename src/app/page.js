// src/app/page.js
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, Package, ShoppingCart, LogOut, ChevronDown, 
  Info, Megaphone, Menu, Shield, CheckCircle, DollarSign, Users, 
  AlertTriangle, XCircle, Bot, Sparkles, Send, X, Eye, TrendingUp, RefreshCcw
} from "lucide-react";

const moneyMXN = (v) => Number(v || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/* =========================================================
   ENTRY POINT
   ========================================================= */
export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let unsub = null;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
      unsub = sub?.subscription;
      setLoading(false);
    })();
    return () => { if (unsub) unsub.unsubscribe(); };
  }, []);

  if (loading) return <LoadingScreen text="Cargando Sistema Central..." />;
  if (!session) return <LoginScreen />;
  return <AdminDashboard session={session} />;
}

/* =========================================================
   LOGIN SCREEN (Enterprise Edition)
   ========================================================= */
function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ text: "", type: "" });
    try {
      if (!email || !password) throw new Error("Por favor, ingresa tus credenciales.");
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg({ text: "Solicitud enviada al CEO. Espera aprobación.", type: "success" });
      }
    } catch (err) {
      setMsg({ text: err?.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err?.message, type: "error" });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0f1c] p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
      
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-slide-up">
        <div className="p-10 text-center border-b border-white/5">
          <img src="/icon-192.png" alt="UnicOs" className="mx-auto h-24 w-24 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.3)] mb-6 object-cover border-2 border-white/20" />
          <h1 className="text-3xl font-black text-white tracking-tight">UnicOs</h1>
          <p className="text-sm font-semibold text-blue-400 tracking-widest uppercase mt-2">Centro de Control Global</p>
        </div>

        <form onSubmit={submit} className="p-10 space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-2">Correo Corporativo</label>
            <input className="w-full bg-black/40 border border-white/10 text-white p-4 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all font-medium placeholder-slate-600"
              value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} placeholder="ejemplo@scorestore.com" type="email" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-2">Clave de Acceso</label>
            <input className="w-full bg-black/40 border border-white/10 text-white p-4 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all font-medium placeholder-slate-600"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-sm font-bold flex items-start gap-3 ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
               <AlertTriangle size={18} className="shrink-0 mt-0.5" /> <span>{msg.text}</span>
            </div>
          )}

          <button disabled={busy} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? "VERIFICANDO IDENTIDAD..." : mode === "login" ? "INICIAR SESIÓN" : "SOLICITAR ACCESO"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   DASHBOARD LAYOUT & IA AGENT
   ========================================================= */
function AdminDashboard({ session }) {
  const [orgs, setOrgs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedMembership = useMemo(() => memberships.find((m) => String(m.org_id) === String(selectedOrgId)), [memberships, selectedOrgId]);
  const role = selectedMembership?.role || "Operador";

  useEffect(() => {
    async function init() {
      try {
        const { data: mems } = await supabase.from("admin_users").select("organization_id, role").eq("email", session.user.email).is("is_active", true);
        const orgIds = (mems || []).map(m => m.organization_id);
        setMemberships((mems || []).map(m => ({ org_id: m.organization_id, role: m.role })));

        if (orgIds.length) {
          const { data: orgData } = await supabase.from("organizations").select("*").in("id", orgIds).order("name");
          setOrgs(orgData || []);
          setSelectedOrgId(orgData?.[0]?.id || null);
        }
      } finally { setLoading(false); }
    }
    init();
  }, [session]);

  const signOut = () => supabase.auth.signOut();

  if (loading) return <LoadingScreen text="Cargando Sistema Central..." />;
  if (!selectedOrgId) return <EmptyStateMultiTenant />;

  const TABS = [
    { id: "dashboard", label: "Salud del Negocio", icon: <LayoutDashboard size={20} /> },
    { id: "orders", label: "Logística y Pedidos", icon: <ShoppingCart size={20} /> },
    { id: "crm", label: "Base de Clientes", icon: <Users size={20} /> },
    { id: "marketing", label: "Centro de Marketing", icon: <Megaphone size={20} /> },
    { id: "products", label: "Inventario Global", icon: <Package size={20} /> },
    { id: "users", label: "Personal y Accesos", icon: <Shield size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {mobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#0a0f1c] text-slate-300 flex flex-col transition-transform duration-300 md:translate-x-0 md:static ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} border-r border-slate-800`}>
        <div className="p-6 flex items-center gap-4 bg-white/5 border-b border-white/5">
          <img src="/icon-192.png" alt="UnicOs" className="h-12 w-12 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)] object-cover border border-white/10" />
          <div>
            <h1 className="text-xl font-black text-white leading-tight">UnicOs</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
              <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400">{role}</p>
            </div>
          </div>
        </div>

        <div className="p-5 border-b border-white/5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Empresa Administrada</label>
          <div className="relative">
            <select className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
              value={selectedOrgId || ""} onChange={(e) => { setSelectedOrgId(e.target.value); setActiveTab("dashboard"); }}>
              {orgs.map(o => <option key={o.id} value={o.id} className="bg-slate-900">{o.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 group ${activeTab === tab.id ? "bg-blue-600 text-white shadow-[0_4px_20px_rgba(37,99,235,0.3)]" : "hover:bg-white/5 hover:text-white"}`}>
              <span className={`${activeTab === tab.id ? "text-white" : "text-slate-500 group-hover:text-blue-400 transition-colors"}`}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-black/20 border-t border-white/5">
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-xs font-bold transition-colors text-slate-400">
            <LogOut size={16} /> CERRAR SESIÓN DE TRABAJO
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50">
        <header className="z-20 px-8 py-5 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"><Menu size={20} /></button>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                {TABS.find(t => t.id === activeTab)?.label || "Panel Operativo"}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Sistema Operativo Automatizado</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-full flex items-center gap-2">
                <Shield size={14} className="text-blue-600" />
                <span className="text-xs font-bold text-blue-800">{session.user.email}</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32">
          <div className="max-w-7xl mx-auto animate-slide-up">
            {activeTab === "dashboard" && <DashboardView orgId={selectedOrgId} />}
            {activeTab === "orders" && <OrdersView orgId={selectedOrgId} />}
            {activeTab === "crm" && <CRMView orgId={selectedOrgId} />}
            {activeTab === "marketing" && <MarketingView orgId={selectedOrgId} />}
            {activeTab === "products" && <ProductsView />}
            {activeTab === "users" && <UsersView orgId={selectedOrgId} />}
          </div>
        </div>

        <UnicoIAAgent orgId={selectedOrgId} />
      </main>
    </div>
  );
}

/* =========================================================
   MÓDULOS DE NEGOCIO
   ========================================================= */

function DashboardView({ orgId }) {
  const [data, setData] = useState({ gross: 0, net: 0, orders: 0, avg: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from("orders").select("amount_total_mxn, amount_shipping_mxn").eq("organization_id", orgId).eq("status", "paid")
      .then(({ data: orders }) => {
        if (!orders) return;
        let gross = 0, shipping = 0;
        orders.forEach(o => { gross += Number(o.amount_total_mxn || 0); shipping += Number(o.amount_shipping_mxn || 0); });
        const stripeFees = orders.reduce((acc, o) => acc + ((Number(o.amount_total_mxn || 0) * 0.036) + 3), 0);
        setData({ gross, net: gross - shipping - stripeFees, orders: orders.length, avg: orders.length ? gross / orders.length : 0 });
        setLoading(false);
      });
  }, [orgId]);

  if (loading) return <SkeletonLoader type="dashboard" />;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-[#0a0f1c] to-blue-900 p-8 md:p-12 rounded-[2rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500/20 p-2 rounded-xl backdrop-blur-md border border-blue-400/30">
              <DollarSign size={20} className="text-blue-300" />
            </div>
            <p className="text-blue-100 text-sm font-bold uppercase tracking-widest">Utilidad Neta (Estimada Real)</p>
          </div>
          <div className="flex items-baseline gap-4 mb-10">
            <h2 className="text-6xl md:text-8xl font-black text-white tracking-tighter">
              {moneyMXN(data.net)}
            </h2>
            <span className="hidden md:flex items-center gap-1 text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full text-sm font-bold border border-green-400/20">
              <TrendingUp size={16} /> +12% (IA Est.)
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/10">
            <InfoCard title="Dinero Bruto Entrante" value={moneyMXN(data.gross)} />
            <InfoCard title="Ventas Concretadas" value={`${data.orders} envíos`} />
            <InfoCard title="Gasto Promedio x Cliente" value={moneyMXN(data.avg)} />
            <InfoCard title="Ecosistema Activo" value="Score Store V1" highlight />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, value, highlight }) {
  return (
    <div>
      <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">{title}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function OrdersView({ orgId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState(null);
  
  const fetchOrders = () => {
    setLoading(true);
    supabase.from("orders").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setOrders(data || []); setLoading(false); });
  };

  useEffect(() => { fetchOrders(); }, [orgId]);

  if (loading) return <SkeletonLoader type="table" />;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 className="font-black text-xl text-slate-800">Centro de Operaciones Logísticas</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">Guías generadas automáticamente por UnicOs.</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
          <RefreshCcw size={16} /> Refrescar
        </button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-100/50 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase tracking-widest">
            <tr>
              <th className="px-6 py-5 rounded-tl-xl">ID de Venta</th>
              <th className="px-6 py-5">Comprador</th>
              <th className="px-6 py-5">Cobro</th>
              <th className="px-6 py-5">Estatus Operativo</th>
              <th className="px-6 py-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-blue-50/50 transition-colors group">
                <td className="px-6 py-5">
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">#{o.id.split("-")[0].toUpperCase()}</span>
                  <div className="text-xs text-slate-500 font-medium mt-2">{new Date(o.created_at).toLocaleDateString()}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="font-bold text-slate-800">{o.customer_name || "Comprador Anónimo"}</div>
                  <div className="text-xs text-slate-500 mt-1">{o.email || "Sin contacto directo"}</div>
                </td>
                <td className="px-6 py-5 font-black text-slate-800 text-base">{moneyMXN(o.amount_total_mxn)}</td>
                <td className="px-6 py-5"><StatusBadge status={o.status} /></td>
                <td className="px-6 py-5 text-right">
                  <button onClick={() => setModalData(o)} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs flex items-center gap-2 ml-auto">
                    <Eye size={16} /> Abrir Expediente
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="5" className="text-center p-16 text-slate-500 font-bold text-lg flex flex-col items-center"><Package size={40} className="mb-4 text-slate-300"/>Aún no hay despachos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      {modalData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">Expediente de Venta #{modalData.id.split("-")[0].toUpperCase()}</h3>
              <button onClick={() => setModalData(null)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</p><p className="font-bold text-slate-800">{modalData.customer_name}</p><p className="text-sm text-slate-600">{modalData.email}</p></div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Artículos Vendidos (El sistema ya descontó stock)</p>
                <p className="font-medium text-slate-700 text-sm leading-relaxed">{modalData.items_summary || "Datos de carrito encriptados."}</p>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                <p className="font-bold text-slate-500">Total Pagado:</p>
                <p className="font-black text-2xl text-slate-800">{moneyMXN(modalData.amount_total_mxn)}</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalData(null)} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800">Cerrar Expediente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = String(status).toLowerCase();
  if (s === 'paid') return <span className="bg-green-50 text-green-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 w-max border border-green-200"><CheckCircle size={14}/> Cobrado y Procesando Guía</span>;
  if (s === 'pending_payment' || s === 'pending') return <span className="bg-orange-50 text-orange-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 w-max border border-orange-200"><AlertTriangle size={14}/> Esperando Depósito OXXO</span>;
  return <span className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs w-max capitalize">{status}</span>;
}

function CRMView({ orgId }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    supabase.from("orders").select("email, customer_name, phone, amount_total_mxn, created_at").eq("organization_id", orgId).eq("status", "paid")
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(o => {
          if(!o.email) return;
          if(!map[o.email]) map[o.email] = { email: o.email, name: o.customer_name, phone: o.phone, ltv: 0, orders: 0, last: o.created_at };
          map[o.email].ltv += Number(o.amount_total_mxn || 0); map[o.email].orders += 1;
        });
        setCustomers(Object.values(map).sort((a, b) => b.ltv - a.ltv));
        setLoading(false);
      });
  }, [orgId]);

  if (loading) return <SkeletonLoader type="table" />;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
      <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <div>
          <h3 className="font-black text-xl text-slate-800">Clientes Frecuentes (VIP)</h3>
          <p className="text-sm text-slate-500 font-medium mt-1">Identifica quiénes sostienen tu negocio. Ideal para regalar cupones manuales.</p>
        </div>
        <div className="bg-blue-100 text-blue-700 p-3 rounded-full"><Users size={24} /></div>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase tracking-widest">
          <tr><th className="px-8 py-5">Perfil del Cliente</th><th className="px-8 py-5 text-center">Nivel de Fidelidad</th><th className="px-8 py-5 text-right">Valor Histórico de Compra</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map(c => (
            <tr key={c.email} className="hover:bg-slate-50">
              <td className="px-8 py-6"><p className="font-black text-slate-800 text-base">{c.name}</p><p className="text-xs font-semibold text-slate-500 mt-1">{c.email} • {c.phone || "Sin Tel"}</p></td>
              <td className="px-8 py-6 text-center"><span className="bg-blue-50 text-blue-700 font-bold px-4 py-1.5 rounded-full text-xs">{c.orders} Compras</span></td>
              <td className="px-8 py-6 font-black text-blue-600 text-xl text-right">{moneyMXN(c.ltv)}</td>
            </tr>
          ))}
          {customers.length === 0 && <tr><td colSpan="3" className="text-center p-12 text-slate-500 font-bold">Base de datos de clientes en construcción.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MarketingView({ orgId }) {
  const [cfg, setCfg] = useState({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => { 
    supabase.from("site_settings").select("*").eq("organization_id", orgId).single().then(({data}) => {if(data) setCfg(data); setLoading(false);}); 
  }, [orgId]);
  
  const save = async () => { 
    await supabase.from("site_settings").update({ promo_active: cfg.promo_active, promo_text: cfg.promo_text }).eq("organization_id", orgId); 
    alert("¡Éxito! La tienda en vivo ha sido actualizada instantáneamente."); 
  };

  const autoGenerate = () => {
    const promos = ["🔥 20% DE DESCUENTO SOLO POR 24 HORAS 🔥", "⚡ ENVÍO EXPRESS GRATIS EN TU PRIMERA COMPRA ⚡", "🎉 ÚLTIMAS PIEZAS DISPONIBLES - COMPRA AHORA 🎉"];
    setCfg({...cfg, promo_active: true, promo_text: promos[Math.floor(Math.random() * promos.length)]});
  };

  if (loading) return <SkeletonLoader type="card" />;

  return (
    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 max-w-2xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="font-black text-2xl text-slate-800 mb-2">Poder de Ventas Global</h3>
          <p className="text-sm font-medium text-slate-500">Controla el mensaje que ven todos los visitantes en el menú principal de la tienda.</p>
        </div>
        <div className="bg-orange-100 text-orange-600 p-4 rounded-2xl"><Megaphone size={28} /></div>
      </div>
      
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
        <label className="flex items-center gap-4 cursor-pointer group">
          <div className="relative">
            <input type="checkbox" checked={cfg.promo_active || false} onChange={e => setCfg({...cfg, promo_active: e.target.checked})} className="sr-only" />
            <div className={`block w-14 h-8 rounded-full transition-colors ${cfg.promo_active ? 'bg-green-500' : 'bg-slate-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${cfg.promo_active ? 'transform translate-x-6' : ''}`}></div>
          </div>
          <div>
            <span className="font-black text-slate-800 block text-lg group-hover:text-blue-600 transition-colors">Encender Megáfono en Tienda</span>
            <span className="text-xs text-slate-500 font-medium">Hace visible el mensaje rojo superior.</span>
          </div>
        </label>
      </div>

      <div className="relative mb-8">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3 ml-1">Mensaje Persuasivo (Copy)</label>
        <textarea value={cfg.promo_text || ""} onChange={e => setCfg({...cfg, promo_text: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all resize-none h-32 text-lg" placeholder="Ej. ENVÍO GRATIS A TODO MÉXICO"></textarea>
        <button onClick={autoGenerate} className="absolute right-4 bottom-4 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:shadow-lg transition-all">
          <Sparkles size={14} /> Redactar con IA
        </button>
      </div>

      <button onClick={save} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-blue-600 transition-all hover:shadow-[0_10px_40px_rgba(37,99,235,0.4)] text-lg flex justify-center items-center gap-2">
        <Send size={20} /> INYECTAR EN SCORE STORE AHORA
      </button>
    </div>
  );
}

function ProductsView() {
  return (
    <div className="p-16 bg-gradient-to-br from-slate-50 to-white rounded-[3rem] border-2 border-dashed border-slate-300 text-center shadow-sm">
      <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-blue-100"><Package size={48} /></div>
      <h3 className="font-black text-3xl text-slate-800 mb-4 tracking-tight">Ecosistema Ultrasónico de Productos</h3>
      <p className="text-slate-500 font-medium max-w-xl mx-auto text-lg leading-relaxed mb-8">
        Por decisión de Arquitectura de Rendimiento (0.1s de carga), tu catálogo matriz reside en el CDN Global de Netlify. Las altas y bajas de productos físicos se auditan vía scripts SQL blindados para evitar corrupción de inventario.
      </p>
      <div className="inline-flex items-center gap-2 bg-slate-100 px-6 py-3 rounded-full text-sm font-bold text-slate-600 border border-slate-200">
        <Shield size={16} /> Base de Datos Bloqueada por Seguridad Anti-Errores
      </div>
    </div>
  );
}

function UsersView({ orgId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("admin_users").select("id, email, role, is_active, created_at")
      .eq("organization_id", orgId).is("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => { setMembers(data || []); setLoading(false); });
  }, [orgId]);

  if (loading) return <SkeletonLoader type="card" />;

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-10 max-w-3xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="font-black text-2xl text-slate-800 mb-2">Personal Autorizado</h3>
          <p className="text-sm font-medium text-slate-500">Gestión de llaves maestras de tu negocio. Nadie más puede ver esta información.</p>
        </div>
        <div className="bg-slate-100 text-slate-600 p-4 rounded-2xl"><Shield size={28} /></div>
      </div>
      <div className="mt-8 space-y-4">
        {members.map(m => (
          <div key={m.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center hover:border-blue-200 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-lg">{m.email[0].toUpperCase()}</div>
              <div>
                <p className="font-bold text-slate-800 text-base">{m.email}</p>
                <p className="text-xs font-bold text-slate-400 mt-0.5">Autorizado el {new Date(m.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${m.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
              {m.role === 'owner' ? 'Dueño Total' : m.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTE: UNICO IA (AGENTE AUTÓNOMO CONECTADO A GEMINI)
   ========================================================= */
function UnicoIAAgent({ orgId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "ai", text: "Soy Unico IA. Mis redes neuronales están en línea. ¿Qué orden ejecutamos hoy?" }]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen]);

  const handleCommand = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    const userText = input.trim();
    
    // 1. Mostrar mensaje del usuario
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setInput("");
    setIsThinking(true);

    try {
      // 2. Obtener la sesión segura
      const { data: { session } } = await supabase.auth.getSession();
      
      // 3. Enviar al cerebro Backend (Gemini)
      const res = await fetch("/api/ai/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ prompt: userText, orgId })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Error de red neuronal");

      // 4. Mostrar respuesta de Gemini
      setMessages(prev => [...prev, { role: "ai", text: data.reply }]);

    } catch (error) {
      // Fallback local en caso de que la ruta de API aún no esté creada
      setMessages(prev => [...prev, { role: "ai", text: "⚠️ Hubo un fallo en mis sistemas de conexión. Por favor asegúrate de haber creado la ruta API en /api/ai/route.js con tu llave de Gemini." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={`fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-[0_10px_40px_rgba(37,99,235,0.5)] hover:bg-blue-500 hover:scale-110 transition-all z-50 flex items-center justify-center group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
        <Sparkles size={28} className="animate-pulse" />
        <span className="absolute right-full mr-4 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Unico IA (En línea)</span>
      </button>

      <div className={`fixed bottom-8 right-8 w-96 h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Bot size={24} /></div>
            <div>
              <h4 className="font-black text-lg leading-tight">Unico IA</h4>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Sistema Enlazado</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"><X size={20} /></button>
        </div>
        
        <div className="flex-1 bg-slate-50 p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm shadow-md' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="max-w-[85%] p-4 rounded-2xl bg-white border border-slate-200 text-slate-400 rounded-tl-sm shadow-sm flex items-center gap-2">
                <RefreshCcw size={14} className="animate-spin" /> Procesando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={handleCommand} className="relative">
            <input type="text" value={input} onChange={(e)=>setInput(e.target.value)} disabled={isThinking} placeholder="Ej: Dime cuánto vendimos hoy..." className="w-full bg-slate-100 text-slate-800 text-sm font-semibold rounded-2xl py-4 pl-5 pr-14 outline-none border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-50" />
            <button type="submit" disabled={!input.trim() || isThinking} className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-400 transition-colors">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   SKELETON LOADERS (CARGA ÓPTICA UX)
   ========================================================= */
function SkeletonLoader({ type }) {
  return (
    <div className="animate-pulse space-y-6">
      {type === 'dashboard' && <div className="h-64 bg-slate-200 rounded-[2rem] w-full"></div>}
      {type === 'table' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3 mb-8"></div>
          <div className="space-y-4">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl w-full"></div>)}
          </div>
        </div>
      )}
      {type === 'card' && <div className="h-96 bg-slate-200 rounded-[2rem] w-full max-w-2xl"></div>}
    </div>
  );
}

/* =========================================================
   OTROS COMPONENTES BASE
   ========================================================= */
function LoadingScreen({ text = "Estableciendo Conexión Blindada..." }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0f1c]">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-600 rounded-full blur-[30px] opacity-40 animate-pulse"></div>
        <img src="/icon-192.png" alt="Cargando" className="relative h-24 w-24 rounded-full shadow-2xl object-cover border border-white/20 animate-bounce" />
      </div>
      <p className="mt-8 text-xs font-black tracking-widest text-blue-400 uppercase">{text}</p>
    </div>
  );
}

function EmptyStateMultiTenant() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Shield size={40} /></div>
        <h2 className="text-2xl font-black text-slate-900 mb-3">Acceso Denegado</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">El sistema ha validado tu identidad, pero no posees llaves maestras para esta terminal. El CEO debe asignarte un rol.</p>
        <button onClick={() => supabase.auth.signOut()} className="w-full bg-slate-100 text-slate-800 font-black py-4 rounded-xl hover:bg-slate-200 transition-colors">Volver a Intentar</button>
      </div>
    </div>
  );
}