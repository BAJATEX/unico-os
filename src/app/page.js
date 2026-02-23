// src/app/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hasPerm, canManageUsers } from "@/lib/authz";
import {
  LayoutDashboard, Package, Settings, ShoppingCart, LogOut, ChevronDown, 
  Info, Megaphone, Bell, Menu, Shield, 
  CheckCircle, DollarSign, Users, Truck, AlertTriangle
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
   LOGIN SCREEN (Enterprise Meta/Shopify Style)
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
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden relative z-10 animate-slide-up">
        <div className="p-8 text-center border-b border-slate-100 bg-slate-50/50">
          <div className="mx-auto h-16 w-16 bg-unico-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-red-500/30 mb-4">U</div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">UnicOs <span className="text-unico-600">Admin</span></h1>
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-2">Central Command</p>
        </div>

        <form onSubmit={submit} className="p-8 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Correo Corporativo</label>
            <input className="mt-1 w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-xl outline-none focus:border-unico-600 focus:ring-4 focus:ring-unico-600/10 transition-all font-semibold text-slate-800"
              value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="admin@empresa.com" type="email" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Clave de Acceso</label>
            <input className="mt-1 w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-xl outline-none focus:border-unico-600 focus:ring-4 focus:ring-unico-600/10 transition-all font-semibold text-slate-800"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-sm font-bold flex items-start gap-2 ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
               <AlertTriangle size={18} className="shrink-0 mt-0.5" /> <span>{msg.text}</span>
            </div>
          )}

          <button disabled={busy} className="w-full bg-slate-900 hover:bg-unico-600 text-white font-black py-4 rounded-xl shadow-lg transition-colors duration-300 disabled:opacity-50">
            {busy ? "AUTENTICANDO..." : mode === "login" ? "INICIAR SESIÓN" : "SOLICITAR ACCESO"}
          </button>

          <div className="text-center pt-2">
            <button type="button" className="text-xs font-bold text-slate-400 hover:text-unico-600 transition-colors" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "¿No tienes acceso? Solicitar cuenta" : "Volver al inicio de sesión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   DASHBOARD LAYOUT (El Core de UnicOs)
   ========================================================= */
function AdminDashboard({ session }) {
  const [orgs, setOrgs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [helpMsg, setHelpMsg] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifyAuth, setNotifyAuth] = useState(false);

  const selectedMembership = useMemo(() => memberships.find((m) => String(m.org_id) === String(selectedOrgId)), [memberships, selectedOrgId]);
  const role = selectedMembership?.role || "viewer";

  useEffect(() => {
    async function init() {
      try {
        const { data: mems } = await supabase.from("admin_users").select("organization_id, role").eq("email", session.user.email).is("is_active", true);
        const orgIds = (mems || []).map(m => m.organization_id);
        
        // Mapeo a la estructura antigua del componente para que no rompa
        const mappedMems = (mems || []).map(m => ({ org_id: m.organization_id, role: m.role }));
        setMemberships(mappedMems);

        if (orgIds.length) {
          const { data: orgData } = await supabase.from("organizations").select("*").in("id", orgIds).order("name");
          setOrgs(orgData || []);
          setSelectedOrgId(orgData?.[0]?.id || null);
        }
        if ("Notification" in window && Notification.permission === "granted") setNotifyAuth(true);
      } finally { setLoading(false); }
    }
    init();
  }, [session]);

  const signOut = () => supabase.auth.signOut();
  const requestNotify = async () => {
    if ("Notification" in window && await Notification.requestPermission() === "granted") setNotifyAuth(true);
  };

  if (loading) return <LoadingScreen />;
  if (!selectedOrgId) return <EmptyStateMultiTenant />;

  const TABS = [
    { id: "dashboard", label: "Finanzas & KPIs", icon: <LayoutDashboard size={20} />, reqPerm: "dashboard" },
    { id: "orders", label: "Pedidos & Envíos", icon: <ShoppingCart size={20} />, reqPerm: "orders" },
    { id: "products", label: "Inventario", icon: <Package size={20} />, reqPerm: "products" },
    { id: "crm", label: "Clientes (CRM)", icon: <Users size={20} />, reqPerm: "crm" },
    { id: "marketing", label: "Marketing", icon: <Megaphone size={20} />, reqPerm: "marketing" },
    { id: "settings", label: "Configuración", icon: <Settings size={20} />, reqPerm: "settings" },
    { id: "users", label: "Equipo", icon: <Shield size={20} />, reqPerm: "users" }
  ].filter(t => hasPerm(role, t.reqPerm));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {mobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 md:translate-x-0 md:static ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 flex items-center gap-3 bg-slate-950/50 border-b border-slate-800">
          <div className="h-10 w-10 bg-unico-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-unico-600/20">U</div>
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
            <select className="w-full appearance-none bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-unico-600"
              value={selectedOrgId || ""} onChange={(e) => { setSelectedOrgId(e.target.value); setActiveTab("dashboard"); }}>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? "bg-unico-600 text-white shadow-lg shadow-unico-600/20" : "hover:bg-slate-800 hover:text-white"}`}>
              <span className={`${activeTab === tab.id ? "text-white" : "text-slate-500"}`}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
          {!notifyAuth && (
            <button onClick={requestNotify} className="mb-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors">
              <Bell size={14} /> Activar Alertas
            </button>
          )}
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-xs font-bold transition-colors">
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="glass-header z-20 px-6 py-4 flex justify-between items-center sticky top-0">
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
            {activeTab === "settings" && <SettingsView />}
            {activeTab === "users" && <UsersView orgId={selectedOrgId} role={role} />}
          </div>
        </div>
      </main>

      {helpMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl max-w-sm flex gap-4 animate-slide-up border border-slate-700">
          <Info className="text-unico-600 shrink-0 mt-0.5" size={24} />
          <div>
            <h4 className="font-bold text-sm mb-1 text-slate-100">Score System Intel</h4>
            <p className="text-sm text-slate-400 leading-relaxed">{helpMsg}</p>
            <button onClick={() => setHelpMsg(null)} className="text-xs font-bold mt-3 text-unico-600 hover:text-white uppercase tracking-widest">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   VISTAS DE MÓDULOS 
   ========================================================= */

function DashboardView({ orgId }) {
  const [data, setData] = useState({ gross: 0, net: 0, orders: 0, avg: 0 });

  useEffect(() => {
    supabase.from("orders").select("amount_total_mxn, amount_shipping_mxn, amount_discount_mxn").eq("org_id", orgId).eq("status", "paid")
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
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-unico-600/20 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <DollarSign size={14} className="text-unico-600" /> Utilidad Neta (Estimada)
          </p>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8">
            {moneyMXN(data.net)}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-800/50">
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Ingreso Bruto</p><p className="text-xl font-bold text-white">{moneyMXN(data.gross)}</p></div>
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Pedidos Pagados</p><p className="text-xl font-bold text-white">{data.orders}</p></div>
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Ticket Promedio</p><p className="text-xl font-bold text-white">{moneyMXN(data.avg)}</p></div>
            <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Conversión</p><p className="text-xl font-bold text-white">—</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrdersView({ orgId, setHelp, role }) {
  const [orders, setOrders] = useState([]);
  const canWrite = ["owner", "admin", "ops", "sales"].includes(role?.toLowerCase());

  useEffect(() => {
    supabase.from("orders").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setOrders(data || []));
  }, [orgId]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden tech-shadow">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-black text-lg text-slate-800">Últimos Pedidos</h3>
        <button onClick={() => setHelp("Los pedidos 'paid' requieren que generes la guía de Envía.com.")} className="text-slate-400 hover:text-unico-600"><Info size={20}/></button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">ID / Fecha</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Resumen Items</th>
              <th className="px-6 py-4">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4"><span className="font-mono font-bold text-unico-600">#{o.id.split("-")[0].toUpperCase()}</span><div className="text-xs text-slate-400 font-medium mt-1">{new Date(o.created_at).toLocaleDateString()}</div></td>
                <td className="px-6 py-4"><div className="font-bold text-slate-800">{o.customer_name || "Sin Nombre"}</div><div className="text-xs text-slate-500">{o.email || "Sin correo"}</div></td>
                <td className="px-6 py-4"><div className="text-xs text-slate-600 max-w-[200px] truncate" title={o.items_summary}>{o.items_summary || "Ver detalles"}</div><div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Vía: {o.shipping_mode || "N/A"}</div></td>
                <td className="px-6 py-4 font-black text-slate-800">{moneyMXN(o.amount_total_mxn)}</td>
                <td className="px-6 py-4"><StatusPill status={o.status} /></td>
                <td className="px-6 py-4 text-right">
                   {canWrite && o.status === 'paid' && (<button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-unico-600 transition-colors shadow-md">Generar Guía</button>)}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="6" className="text-center p-12 text-slate-400 font-bold">Sin registros recientes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const s = String(status).toLowerCase();
  if (s === 'paid') return <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 w-max"><CheckCircle size={12}/> Pagado</span>;
  if (s === 'pending_payment' || s === 'pending') return <span className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 w-max"><AlertTriangle size={12}/> Pendiente OXXO</span>;
  if (s === 'shipped') return <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 w-max"><Truck size={12}/> Enviado</span>;
  return <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full text-xs w-max">{status}</span>;
}

function UsersView({ orgId, role }) {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("sales");
  const [refresh, setRefresh] = useState(0);

  const canManage = canManageUsers(role);

  useEffect(() => {
    supabase.from("admin_users").select("id, email, role, is_active, created_at")
      .eq("organization_id", orgId).is("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => setMembers(data || []));
  }, [orgId, refresh]);

  const invite = async () => {
    if (!inviteEmail) return alert("Ingresa un correo");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/invite", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ organization_id: orgId, email: inviteEmail, role: inviteRole })
    });
    if (!res.ok) { const j = await res.json(); return alert(j?.error || "Error al invitar."); }
    setInviteEmail(""); setRefresh(p => p + 1); alert("Invitación enviada.");
  };

  const removeMember = async (userId) => {
    if (!confirm("¿Revocar acceso?")) return;
    await supabase.from("admin_users").update({ is_active: false }).eq("id", userId);
    setRefresh(p => p + 1);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 tech-shadow">
        <h3 className="font-black text-xl text-slate-800 mb-4">Gestión de Equipo</h3>
        {canManage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="equipo@score.com" className="p-3 rounded-xl border border-slate-200 outline-none font-semibold text-sm" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="p-3 rounded-xl border border-slate-200 outline-none font-bold text-sm bg-white">
              <option value="owner">Owner (Control Total)</option>
              <option value="admin">Admin</option>
              <option value="ops">Operaciones (Logística)</option>
              <option value="sales">Ventas (CRM)</option>
              <option value="marketing">Marketing</option>
            </select>
            <button onClick={invite} className="bg-slate-900 text-white font-bold rounded-xl px-4 py-3 hover:bg-unico-600 transition-colors">Añadir Usuario</button>
          </div>
        )}
        <div className="mt-6 divide-y divide-slate-100">
          {members.map(m => (
            <div key={m.id} className="py-4 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{m.email}</p>
                <p className="text-xs font-semibold text-unico-600 uppercase tracking-widest">{m.role}</p>
              </div>
              {canManage && <button onClick={() => removeMember(m.id)} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100">Revocar</button>}
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
              <td className="px-6 py-4 font-black text-unico-600 text-right">{moneyMXN(c.ltv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketingView({ orgId }) {
  const [cfg, setCfg] = useState({});
  useEffect(() => { supabase.from("site_settings").select("*").eq("organization_id", orgId).single().then(({data}) => {if(data) setCfg(data)}); }, [orgId]);
  const save = async () => { await supabase.from("site_settings").update({ promo_active: cfg.promo_active, promo_text: cfg.promo_text }).eq("organization_id", orgId); alert("Marketing Guardado"); };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm tech-shadow max-w-xl animate-slide-up">
      <h3 className="font-black text-xl text-slate-800 mb-6">Cintillo de Ofertas Global</h3>
      <div className="flex items-center gap-3 mb-4">
        <input type="checkbox" checked={cfg.promo_active || false} onChange={e => setCfg({...cfg, promo_active: e.target.checked})} className="w-5 h-5 accent-unico-600" />
        <span className="font-bold text-slate-700">Activar Banner Superior</span>
      </div>
      <textarea value={cfg.promo_text || ""} onChange={e => setCfg({...cfg, promo_text: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-700 outline-none focus:border-unico-600" placeholder="Ej. ENVÍO GRATIS A TODO MÉXICO"></textarea>
      <button onClick={save} className="mt-4 w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-unico-600 transition-colors">Publicar en Score Store</button>
    </div>
  );
}

function SettingsView() {
  return <div className="p-8 bg-white rounded-[2rem] border border-slate-200 tech-shadow max-w-xl animate-slide-up"><h3 className="font-black text-xl text-slate-800">Ajustes Web Generales</h3><p className="text-slate-500 mt-2 font-medium">Módulo en conexión. Requiere actualización del PWA Frontend.</p></div>;
}

function ProductsView() {
  return <div className="p-12 bg-white rounded-[2rem] border border-dashed border-slate-300 text-center font-bold text-slate-400">Para habilitar el Inventario Dinámico, primero corre el script SQL en Supabase.</div>;
}

function LoadingScreen() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <div className="h-16 w-16 bg-unico-600 rounded-2xl animate-pulse flex items-center justify-center shadow-[0_0_40px_rgba(225,6,0,0.4)] mb-6"><span className="text-white font-black text-2xl">U</span></div>
      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">Cargando UnicOs</p>
    </div>
  );
}

function EmptyStateMultiTenant() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 text-center tech-shadow animate-slide-up">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-6"><Shield size={32} /></div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Tu cuenta ha sido creada pero no tienes ninguna organización asignada. Solicita a un administrador que te invite a Score Store.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-slate-900 hover:text-unico-600 underline">Volver al inicio</button>
      </div>
    </div>
  );
}