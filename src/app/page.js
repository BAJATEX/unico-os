// src/app/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hasPerm, canManageUsers } from "@/lib/authz";
import {
  LayoutDashboard, Package, Settings, ShoppingCart, LogOut, ChevronDown, 
  Info, Megaphone, Bell, Menu, Shield, 
  CheckCircle, DollarSign, Users, Truck, AlertTriangle, XCircle
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

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  return <AdminDashboard session={session} />;
}

/* =========================================================
   LOGIN SCREEN
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
      if (!email || !password) throw new Error("Credenciales requeridas.");
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg({ text: "Cuenta creada. Requiere autorización de un administrador.", type: "success" });
      }
    } catch (err) {
      setMsg({ text: err?.message || "Error de autenticación", type: "error" });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden relative z-10 animate-slide-up">
        <div className="p-8 text-center border-b border-slate-100 bg-slate-50/50">
          <img src="/icon-192.png" alt="UnicOs Logo" className="mx-auto h-20 w-20 rounded-full shadow-lg shadow-blue-500/30 mb-4 object-cover border-4 border-white" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">UnicOs <span className="text-blue-600">Admin</span></h1>
          <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-2">Central Command</p>
        </div>

        <form onSubmit={submit} className="p-8 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Correo Corporativo</label>
            <input className="mt-1 w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-semibold text-slate-800"
              value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="admin@scorestore.com" type="email" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Clave de Acceso</label>
            <input className="mt-1 w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-semibold text-slate-800"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-sm font-bold flex items-start gap-2 ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
               <AlertTriangle size={18} className="shrink-0 mt-0.5" /> <span>{msg.text}</span>
            </div>
          )}

          <button disabled={busy} className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg transition-colors duration-300 disabled:opacity-50">
            {busy ? "AUTENTICANDO..." : mode === "login" ? "INICIAR SESIÓN" : "SOLICITAR ACCESO"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   DASHBOARD LAYOUT
   ========================================================= */
function AdminDashboard({ session }) {
  const [orgs, setOrgs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [helpMsg, setHelpMsg] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedMembership = useMemo(() => memberships.find((m) => String(m.org_id) === String(selectedOrgId)), [memberships, selectedOrgId]);
  const role = selectedMembership?.role || "viewer";

  useEffect(() => {
    async function init() {
      try {
        const { data: mems } = await supabase.from("admin_users").select("organization_id, role").eq("email", session.user.email).is("is_active", true);
        const orgIds = (mems || []).map(m => m.organization_id);
        const mappedMems = (mems || []).map(m => ({ org_id: m.organization_id, role: m.role }));
        setMemberships(mappedMems);

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

  if (loading) return <LoadingScreen />;
  if (!selectedOrgId) return <EmptyStateMultiTenant />;

  const TABS = [
    { id: "dashboard", label: "Finanzas & KPIs", icon: <LayoutDashboard size={20} /> },
    { id: "orders", label: "Pedidos & Envíos", icon: <ShoppingCart size={20} /> },
    { id: "products", label: "Inventario", icon: <Package size={20} /> },
    { id: "crm", label: "Clientes (CRM)", icon: <Users size={20} /> },
    { id: "marketing", label: "Marketing", icon: <Megaphone size={20} /> },
    { id: "users", label: "Equipo", icon: <Shield size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {mobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 md:translate-x-0 md:static ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 flex items-center gap-3 bg-slate-950/50 border-b border-slate-800">
          <img src="/icon-192.png" alt="UnicOs" className="h-10 w-10 rounded-full shadow-lg shadow-blue-600/20 object-cover border-2 border-slate-800" />
          <div>
            <h1 className="text-lg font-black text-white leading-tight tracking-tight">UnicOs</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{role}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-800">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Organización Activa</label>
          <div className="relative">
            <select className="w-full appearance-none bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-600"
              value={selectedOrgId || ""} onChange={(e) => { setSelectedOrgId(e.target.value); setActiveTab("dashboard"); }}>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "hover:bg-slate-800 hover:text-white"}`}>
              <span className={`${activeTab === tab.id ? "text-white" : "text-slate-500"}`}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-xs font-bold transition-colors">
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="glass-header z-20 px-6 py-4 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 bg-slate-100 rounded-lg"><Menu size={20} /></button>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {TABS.find(t => t.id === activeTab)?.label || "Panel"}
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">{session.user.email}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-slate-50/50 pb-32">
          <div className="max-w-7xl mx-auto animate-slide-up">
            {activeTab === "dashboard" && <DashboardView orgId={selectedOrgId} />}
            {activeTab === "orders" && <OrdersView orgId={selectedOrgId} setHelp={setHelpMsg} role={role} />}
            {activeTab === "products" && <ProductsView />}
            {activeTab === "crm" && <CRMView orgId={selectedOrgId} />}
            {activeTab === "marketing" && <MarketingView orgId={selectedOrgId} />}
            {activeTab === "users" && <UsersView orgId={selectedOrgId} role={role} />}
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   VISTAS DE MÓDULOS
   ========================================================= */

function DashboardView({ orgId }) {
  const [data, setData] = useState({ gross: 0, net: 0, orders: 0, avg: 0 });

  useEffect(() => {
    supabase.from("orders").select("amount_total_mxn, amount_shipping_mxn, amount_discount_mxn").eq("organization_id", orgId).eq("status", "paid")
      .then(({ data: orders }) => {
        if (!orders) return;
        let gross = 0, shipping = 0;
        orders.forEach(o => { gross += Number(o.amount_total_mxn || 0); shipping += Number(o.amount_shipping_mxn || 0); });
        const stripeFees = orders.reduce((acc, o) => acc + ((Number(o.amount_total_mxn || 0) * 0.036) + 3), 0);
        setData({ gross, net: gross - shipping - stripeFees, orders: orders.length, avg: orders.length ? gross / orders.length : 0 });
      });
  }, [orgId]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-8 md:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <DollarSign size={14} className="text-blue-500" /> Ingreso Neto (Estimado)
          </p>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8">
            {moneyMXN(data.net)}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-800/50">
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Ingreso Bruto</p><p className="text-xl font-bold text-white">{moneyMXN(data.gross)}</p></div>
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Pedidos Pagados</p><p className="text-xl font-bold text-white">{data.orders}</p></div>
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Ticket Promedio</p><p className="text-xl font-bold text-white">{moneyMXN(data.avg)}</p></div>
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Plataforma</p><p className="text-xl font-bold text-white">Score Store</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrdersView({ orgId, setHelp, role }) {
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    supabase.from("orders").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setOrders(data || []));
  }, [orgId]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden tech-shadow">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-black text-lg text-slate-800">Últimos Pedidos</h3>
        <button onClick={() => setHelp("Los pedidos 'paid' (Pagados) tienen guía automática. 'pending_payment' es OXXO pendiente.")} className="text-slate-400 hover:text-blue-600"><Info size={20}/></button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">ID / Fecha</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Resumen Items</th>
              <th className="px-6 py-4">Total</th><th className="px-6 py-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4"><span className="font-mono font-bold text-blue-600">#{o.id.split("-")[0].toUpperCase()}</span><div className="text-xs text-slate-500 font-medium mt-1">{new Date(o.created_at).toLocaleDateString()}</div></td>
                <td className="px-6 py-4"><div className="font-bold text-slate-800">{o.customer_name || "Sin Nombre"}</div><div className="text-xs text-slate-500">{o.email || "Sin correo"}</div></td>
                <td className="px-6 py-4"><div className="text-xs text-slate-600 max-w-[250px] truncate" title={o.items_summary}>{o.items_summary || "Ver detalles"}</div><div className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Vía: {o.shipping_mode || "N/A"}</div></td>
                <td className="px-6 py-4 font-black text-slate-800">{moneyMXN(o.amount_total_mxn)}</td>
                <td className="px-6 py-4 text-right flex justify-end"><StatusPill status={o.status} /></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="5" className="text-center p-12 text-slate-500 font-bold">Sin registros recientes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const s = String(status).toLowerCase();
  if (s === 'paid') return <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 w-max"><CheckCircle size={12}/> Pagado (Guía Lista)</span>;
  if (s === 'pending_payment' || s === 'pending') return <span className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 w-max"><AlertTriangle size={12}/> Pendiente Pago</span>;
  if (s === 'payment_failed') return <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 w-max"><XCircle size={12}/> Pago Fallido</span>;
  return <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full text-xs w-max">{status}</span>;
}

function UsersView({ orgId }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    supabase.from("admin_users").select("id, email, role, is_active, created_at")
      .eq("organization_id", orgId).is("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => setMembers(data || []));
  }, [orgId]);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 tech-shadow">
        <h3 className="font-black text-xl text-slate-800 mb-4">Equipo Operativo</h3>
        <p className="text-sm text-slate-500 mb-4">Los usuarios se administran directamente desde la base de datos central por seguridad.</p>
        <div className="mt-6 divide-y divide-slate-100">
          {members.map(m => (
            <div key={m.id} className="py-4 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{m.email}</p>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CRMView({ orgId }) {
  const [customers, setCustomers] = useState([]);
  
  useEffect(() => {
    supabase.from("orders").select("email, customer_name, phone, amount_total_mxn, created_at").eq("organization_id", orgId).eq("status", "paid")
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(o => {
          if(!o.email) return;
          if(!map[o.email]) map[o.email] = { email: o.email, name: o.customer_name, phone: o.phone, ltv: 0, orders: 0, last: o.created_at };
          map[o.email].ltv += Number(o.amount_total_mxn || 0); map[o.email].orders += 1;
          if (new Date(o.created_at) > new Date(map[o.email].last)) map[o.email].last = o.created_at;
        });
        setCustomers(Object.values(map).sort((a, b) => b.ltv - a.ltv));
      });
  }, [orgId]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden tech-shadow animate-slide-up">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-black text-xl text-slate-800">Base de Clientes (LTV)</h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase">
          <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Compras</th><th className="px-6 py-4 text-right">LTV (Valor Total)</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map(c => (
            <tr key={c.email} className="hover:bg-slate-50">
              <td className="px-6 py-4"><p className="font-bold text-slate-800">{c.name}</p><p className="text-xs text-slate-500">{c.email} • {c.phone}</p></td>
              <td className="px-6 py-4 font-bold text-slate-600">{c.orders} pedidos</td>
              <td className="px-6 py-4 font-black text-blue-600 text-right">{moneyMXN(c.ltv)}</td>
            </tr>
          ))}
          {customers.length === 0 && <tr><td colSpan="3" className="text-center p-8 text-slate-500 font-bold">Sin clientes registrados.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MarketingView({ orgId }) {
  const [cfg, setCfg] = useState({});
  useEffect(() => { 
    supabase.from("site_settings").select("*").eq("organization_id", orgId).single().then(({data}) => {if(data) setCfg(data)}); 
  }, [orgId]);
  
  const save = async () => { 
    await supabase.from("site_settings").update({ promo_active: cfg.promo_active, promo_text: cfg.promo_text }).eq("organization_id", orgId); 
    alert("Configuración de Marketing Guardada"); 
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm tech-shadow max-w-xl animate-slide-up">
      <h3 className="font-black text-xl text-slate-800 mb-6">Cintillo de Ofertas Global</h3>
      <div className="flex items-center gap-3 mb-4">
        <input type="checkbox" checked={cfg.promo_active || false} onChange={e => setCfg({...cfg, promo_active: e.target.checked})} className="w-5 h-5 accent-blue-600" />
        <span className="font-bold text-slate-700">Activar Banner Superior en Tienda</span>
      </div>
      <textarea value={cfg.promo_text || ""} onChange={e => setCfg({...cfg, promo_text: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-700 outline-none focus:border-blue-600" placeholder="Ej. ENVÍO GRATIS A TODO MÉXICO"></textarea>
      <button onClick={save} className="mt-4 w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors">Publicar en Score Store</button>
    </div>
  );
}

function ProductsView() {
  return (
    <div className="p-12 bg-white rounded-[2rem] border border-dashed border-slate-300 text-center tech-shadow animate-slide-up">
      <Package size={48} className="mx-auto text-slate-300 mb-4" />
      <h3 className="font-black text-xl text-slate-800 mb-2">Inventario en la Nube</h3>
      <p className="text-slate-500 font-medium max-w-md mx-auto">
        El inventario actual está sincronizado mediante un catálogo en el CDN global de Netlify (catalog.json) para garantizar velocidades de carga de 0.1s. Para administrar productos desde aquí, debes ejecutar el script SQL de productos en Supabase.
      </p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <img src="/icon-192.png" alt="UnicOs Logo" className="h-20 w-20 rounded-full animate-pulse shadow-[0_0_40px_rgba(37,99,235,0.4)] mb-6 object-cover border-4 border-slate-800" />
      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">Estableciendo Conexión...</p>
    </div>
  );
}

function EmptyStateMultiTenant() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 text-center tech-shadow animate-slide-up">
        <img src="/icon-192.png" alt="UnicOs" className="mx-auto h-20 w-20 rounded-full mb-6 object-cover shadow-lg" />
        <h2 className="text-xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Tu cuenta ha sido creada pero no tienes acceso administrativo a Score Store. Contacta al CEO.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-slate-900 hover:text-blue-600 underline">Volver al inicio</button>
      </div>
    </div>
  );
}