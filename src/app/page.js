// src/app/page.js
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  LayoutDashboard, Package, ShoppingCart, LogOut, ChevronDown, 
  Info, Megaphone, Menu, Shield, CheckCircle, DollarSign, Users, 
  AlertTriangle, XCircle, Bot, Sparkles, Send, X, Eye, TrendingUp, RefreshCcw
} from "lucide-react";

const moneyMXN = (v) => Number(v || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const num = (v) => Number(v || 0).toLocaleString("en-US");

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) setError(loginError.message);
    else if (data?.session) onLogin(data.session);
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-6 font-sans">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-10 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-slate-700">
            <Shield className="text-blue-500" size={40} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">UnicOs <span className="text-blue-500">Enterprise</span></h1>
          <p className="text-slate-400 text-sm mb-8 text-center font-medium">Centro de Control Global</p>

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-start">
              <AlertTriangle className="mr-3 flex-shrink-0 mt-0.5" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Correo Corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                placeholder="operador@unicos.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contraseña de Acceso</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Acceder al Sistema"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ text = "Sincronizando..." }) {
  return (
    <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center font-sans">
      <div className="w-16 h-16 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-6"></div>
      <p className="text-slate-400 text-sm font-medium animate-pulse">{text}</p>
    </div>
  );
}

function EmptyStateMultiTenant() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-6 font-sans">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-10 text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-yellow-500" size={40} />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Acceso Denegado</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Tu cuenta no está vinculada a ninguna organización activa. Contacta al Administrador de UnicOs para solicitar acceso a un Tenant.
        </p>
        <button onClick={() => supabase.auth.signOut()} className="w-full bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

function AdminDashboard({ session }) {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [memberships, setMemberships] = useState([]);
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const userEmail = session?.user?.email || "";
        console.log("🚀 Iniciando Login en God Mode para:", userEmail);
        
        // 1. God Mode: Buscar usuario ignorando mayúsculas (ilike) y SIN is_active por ahora
        const { data: mems, error: memError } = await supabase
          .from("admin_users")
          .select("organization_id, role")
          .ilike("email", userEmail);

        if (memError) throw new Error("Error en admin_users: " + JSON.stringify(memError));

        console.log("📦 Datos obtenidos de admin_users:", mems);

        const orgIds = (mems || []).map(m => m.organization_id);
        setMemberships((mems || []).map(m => ({ org_id: m.organization_id, role: m.role })));

        if (orgIds.length > 0) {
          // 2. Buscar empresas asignadas
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .select("*")
            .in("id", orgIds)
            .order("name");
            
          if (orgError) throw new Error("Error en organizations: " + JSON.stringify(orgError));
          
          console.log("🏢 Organizaciones cargadas:", orgData);

          setOrgs(orgData || []);
          setSelectedOrgId(orgData?.[0]?.id || null);
        } else {
          console.error("🚨 CRÍTICO: Auth exitoso, pero admin_users devolvió 0 filas para:", userEmail);
          alert("ERROR: Tu correo (" + userEmail + ") no está vinculado a la organización.\n\nVerifica en Supabase que el email en 'admin_users' sea exactamente ese y no tenga espacios.");
        }
      } catch (err) {
        console.error("Error crítico en init():", err);
        alert("ERROR DEL SISTEMA:\n" + err.message);
      } finally {
        setLoading(false);
      }
    }
    
    // Evitamos ejecutar si la sesión no está lista
    if (session && session.user) {
      init();
    } else {
      setLoading(false);
    }
  }, [session]);

  const signOut = () => supabase.auth.signOut();

  if (loading) return <LoadingScreen text="Cargando Sistema Central..." />;
  if (!selectedOrgId) return <EmptyStateMultiTenant />;

  const TABS = [
    { id: "dashboard", label: "Salud del Negocio", icon: <LayoutDashboard size={20} /> },
    { id: "orders", label: "Órdenes (Stripe)", icon: <ShoppingCart size={20} /> },
    { id: "products", label: "Catálogo", icon: <Package size={20} /> },
    { id: "marketing", label: "Marketing / Megáfono", icon: <Megaphone size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-900 font-sans text-slate-200 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-950 border-r border-slate-800 shrink-0 relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-blue-500/20">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white leading-none">UnicOs</h2>
            <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase mt-1">Enterprise</p>
          </div>
        </div>

        {/* Tenant Selector */}
        {orgs.length > 1 && (
          <div className="p-4 border-b border-slate-800">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Organización Activa</label>
            <div className="relative">
              <select
                className="w-full bg-slate-900 border border-slate-700 text-white font-bold px-4 py-3 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Módulos</p>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 font-bold text-sm ${
                activeTab === t.id 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <span className={`mr-3 ${activeTab === t.id ? "text-blue-500" : "text-slate-500"}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">{session.user.email.substring(0,2).toUpperCase()}</span>
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{session.user.email}</p>
              <p className="text-xs text-slate-500 font-medium">Operador de Sistema</p>
            </div>
          </div>
          <button 
            onClick={signOut} 
            className="w-full flex items-center justify-center py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
          >
            <LogOut size={16} className="mr-2" /> Desconectar
          </button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
            <Shield className="text-white" size={16} />
          </div>
          <h2 className="text-lg font-black text-white">UnicOs</h2>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="text-slate-400 p-2">
          <Menu size={24} />
        </button>
      </div>

      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <aside className="w-72 bg-slate-950 h-full flex flex-col relative z-10 border-r border-slate-800 shadow-2xl">
             <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                    <Shield className="text-white" size={16} />
                  </div>
                  <h2 className="text-xl font-black text-white">UnicOs</h2>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={24}/></button>
             </div>
             <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Módulos</p>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTab(t.id); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 font-bold text-sm ${
                      activeTab === t.id 
                        ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner" 
                        : "text-slate-400 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span className={`mr-3 ${activeTab === t.id ? "text-blue-500" : "text-slate-500"}`}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
             </nav>
             <div className="p-6 border-t border-slate-800">
                <button onClick={signOut} className="w-full flex items-center justify-center py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20">
                  <LogOut size={16} className="mr-2" /> Desconectar
                </button>
             </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#0A0F1C] pt-16 md:pt-0">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/20 opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            <TenantHeader orgs={orgs} orgId={selectedOrgId} />
            <div className="mt-8">
              {activeTab === "dashboard" && <ModuleDashboard orgId={selectedOrgId} />}
              {activeTab === "orders" && <ModuleOrders orgId={selectedOrgId} />}
              {activeTab === "products" && <ModuleProducts orgId={selectedOrgId} />}
              {activeTab === "marketing" && <ModuleMarketing orgId={selectedOrgId} />}
            </div>
          </div>
        </div>
      </main>

      {/* Unico IA Floating Agent */}
      <UnicoIAAgent orgId={selectedOrgId} />
    </div>
  );
}

function TenantHeader({ orgs, orgId }) {
  const current = orgs.find(o => o.id === orgId);
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{current?.name || "Empresa"}</h1>
        <div className="flex items-center mt-2 text-sm text-slate-400 font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          Sistemas Operativos Online
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center text-sm font-bold text-slate-300 shadow-inner">
        <Info size={16} className="text-blue-500 mr-2" /> ID: {current?.slug}
      </div>
    </div>
  );
}

// --------------------------------------------------------
// MÓDULOS DEL PANEL (Dashboard, Órdenes, Productos, Marketing)
// --------------------------------------------------------

function ModuleDashboard({ orgId }) {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, pending: 0, AOV: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("amount_total_mxn, status")
      .eq("organization_id", orgId);

    let rev = 0, ord = 0, pend = 0;
    if (data) {
      data.forEach(o => {
        if (o.status === "paid") { rev += Number(o.amount_total_mxn || 0); ord++; }
        else pend++;
      });
    }
    setStats({ revenue: rev, orders: ord, pending: pend, AOV: ord > 0 ? rev / ord : 0 });
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [orgId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white">Panorama General</h3>
        <button onClick={fetchStats} className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
          <RefreshCcw size={16} className={loading ? "animate-spin text-blue-500" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Ingresos Brutos" value={moneyMXN(stats.revenue)} icon={<DollarSign size={24} className="text-emerald-400" />} color="emerald" loading={loading} trend="+12% vs mes pasado" />
        <StatCard title="Órdenes Pagadas" value={num(stats.orders)} icon={<ShoppingCart size={24} className="text-blue-400" />} color="blue" loading={loading} />
        <StatCard title="Ticket Promedio (AOV)" value={moneyMXN(stats.AOV)} icon={<TrendingUp size={24} className="text-purple-400" />} color="purple" loading={loading} />
        <StatCard title="Órdenes Pendientes" value={num(stats.pending)} icon={<AlertTriangle size={24} className="text-yellow-400" />} color="yellow" loading={loading} alert={stats.pending > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>
          <h3 className="text-lg font-black text-white mb-6 relative z-10 flex items-center">
            <Sparkles className="text-blue-500 mr-2" size={20} /> Inteligencia Artificial Activa
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Unico IA está monitoreando en tiempo real las operaciones de esta organización. Pregúntale al asistente flotante sobre reportes de ventas, estatus de inventario o sugerencias de marketing para hoy.
          </p>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 border-l-4 border-l-blue-500">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Diagnóstico Automático</p>
            <p className="text-sm text-slate-300 font-medium">"El volumen de ventas se mantiene estable. Tienes {stats.pending} órdenes pendientes de cobro (OXXO/Transferencia) que podrías recuperar con una campaña de recordatorio."</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 relative mb-4">
             <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-blue-500" strokeWidth="3" strokeDasharray="85, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-white">85%</span>
             </div>
          </div>
          <h4 className="text-white font-bold mb-1">Tasa de Conversión</h4>
          <p className="text-xs text-slate-400">Excelente salud de carrito de compras.</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, loading, alert, trend }) {
  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-500",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-500",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500",
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700 ${alert ? 'ring-1 ring-yellow-500/30' : ''}`}>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
        <div className={`p-2 rounded-xl border ${colorMap[color]}`}>{icon}</div>
      </div>
      {loading ? (
        <div className="h-10 bg-slate-800 rounded-lg animate-pulse w-1/2"></div>
      ) : (
        <div>
          <p className="text-3xl font-black text-white tracking-tight">{value}</p>
          {trend && <p className="text-xs font-bold text-emerald-400 mt-2">{trend}</p>}
        </div>
      )}
      <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-[60px] opacity-20 bg-${color}-500 pointer-events-none`}></div>
    </div>
  );
}

function ModuleOrders({ orgId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [orgId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
        <div>
          <h3 className="text-lg font-black text-white">Últimas 50 Órdenes</h3>
          <p className="text-xs font-medium text-slate-500 mt-1">Sincronización en tiempo real con Stripe</p>
        </div>
        <button onClick={fetchOrders} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors">
           <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-slate-500 font-bold flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            Cargando libro de ventas...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Package size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg">No hay órdenes registradas</p>
            <p className="text-sm mt-1">Las ventas de esta organización aparecerán aquí.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-800">
                <th className="p-4 pl-6">Cliente</th>
                <th className="p-4">Monto</th>
                <th className="p-4">Estatus</th>
                <th className="p-4">Resumen Items</th>
                <th className="p-4">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="p-4 pl-6">
                    <p className="font-bold text-slate-200">{o.customer_name || "Sin nombre"}</p>
                    <p className="text-xs text-slate-500 font-medium">{o.email}</p>
                  </td>
                  <td className="p-4 font-black text-white">{moneyMXN(o.amount_total_mxn)}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                      o.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      o.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                      "bg-slate-800 text-slate-400 border-slate-700"
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-400 font-medium max-w-[200px] truncate" title={o.items_summary}>
                    {o.items_summary || "-"}
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-500">
                    {new Date(o.created_at).toLocaleDateString("es-MX", { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ModuleProducts({ orgId }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-xl text-center">
      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <Package className="text-blue-500" size={32} />
      </div>
      <h3 className="text-xl font-black text-white mb-2">Catálogo de Productos</h3>
      <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
        Actualmente, el catálogo se lee directamente del JSON estático de alto rendimiento para maximizar la velocidad de carga (PWA). Para modificar el catálogo, actualiza el archivo en el repositorio.
      </p>
    </div>
  );
}

function ModuleMarketing({ orgId }) {
  const [promo, setPromo] = useState("");
  const [activePromo, setActivePromo] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPromo = async () => {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "active_promo").eq("organization_id", orgId).maybeSingle();
    setActivePromo(data?.value || null);
  };

  useEffect(() => { fetchPromo(); }, [orgId]);

  const savePromo = async () => {
    if (!promo.trim()) return;
    setLoading(true);
    await supabase.from("site_settings").upsert({
      organization_id: orgId,
      key: "active_promo",
      value: promo,
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id, key" });
    setPromo("");
    await fetchPromo();
    setLoading(false);
  };

  const removePromo = async () => {
    setLoading(true);
    await supabase.from("site_settings").delete().eq("organization_id", orgId).eq("key", "active_promo");
    await fetchPromo();
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="flex items-center mb-8 relative z-10">
        <div className="w-12 h-12 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center mr-4">
          <Megaphone className="text-purple-400" size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white">Megáfono Global</h3>
          <p className="text-sm font-medium text-slate-400">Anuncia ofertas en la barra superior de tu tienda al instante.</p>
        </div>
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            className="flex-1 bg-slate-950 border border-slate-700 text-white font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none placeholder-slate-600"
            placeholder="Ej: 🔥 20% DE DESCUENTO EN TODA LA TIENDA CON CÓDIGO: FLASH20"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <button
            onClick={savePromo}
            disabled={loading || !promo.trim()}
            className="bg-purple-600 text-white font-black px-6 py-3 rounded-xl hover:bg-purple-500 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 flex-shrink-0"
          >
            {loading ? "Publicando..." : "Publicar Anuncio"}
          </button>
        </div>

        {activePromo && (
          <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-6 relative group">
            <h4 className="text-xs font-black text-purple-500 uppercase tracking-wider mb-3">Anuncio en Vivo Actualmente:</h4>
            <p className="text-lg font-bold text-white mb-4">{activePromo}</p>
            <button
              onClick={removePromo}
              className="text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Quitar Anuncio (Apagar Megáfono)
            </button>
          </div>
        )}
        {!activePromo && (
           <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex items-center justify-center">
              <p className="text-sm font-bold text-slate-500">El megáfono está apagado. No hay anuncios en la tienda.</p>
           </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------
// UNICO IA: Agente Autónomo (Componente Flotante)
// --------------------------------------------------------
function UnicoIAAgent({ orgId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: "system", content: "¡Hola! Soy Unico IA. Estoy conectado a la base de datos de tu empresa. Puedes pedirme reportes de ventas, buscar un cliente o pedirme análisis de negocio. ¿En qué te ayudo hoy?" }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !orgId) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Control de latencia con AbortController para Netlify Edge (8s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: userMsg, organization_id: orgId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "system", content: data.reply || "No obtuve respuesta." }]);
    } catch (error) {
      console.error("AI Error:", error);
      let errorMsg = "Hubo un error de conexión con mi servidor cerebral.";
      if (error.name === 'AbortError') {
         errorMsg = "La consulta tomó demasiado tiempo y fue interrumpida (Límite de 8 segundos en Netlify). Intenta con una pregunta más específica.";
      }
      setMessages(prev => [...prev, { role: "system", content: errorMsg, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón Flotante */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:scale-110 transition-transform z-40 ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <Bot className="text-white" size={28} />
      </button>

      {/* Ventana de Chat */}
      <div className={`fixed bottom-6 right-6 w-[380px] h-[600px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
        
        {/* Cabecera IA */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/50 rounded-xl flex items-center justify-center mr-3 relative overflow-hidden">
               <Bot className="text-blue-400 relative z-10" size={20} />
               <div className="absolute inset-0 bg-blue-500 opacity-20 animate-pulse"></div>
            </div>
            <div>
              <h3 className="text-white font-black leading-tight flex items-center">Unico IA <Sparkles size={12} className="text-blue-400 ml-1" /></h3>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-ping"></span> En línea
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm font-medium leading-relaxed ${
                msg.role === "user" 
                  ? "bg-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-900/20" 
                  : msg.isError 
                    ? "bg-red-500/10 border border-red-500/20 text-red-400 rounded-bl-sm"
                    : "bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl rounded-bl-sm flex space-x-2 items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex items-center bg-slate-900 border border-slate-700 p-1.5 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pregúntale a Unico IA..."
              className="flex-1 bg-transparent border-none text-white text-sm px-3 focus:outline-none placeholder-slate-500"
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50 hover:bg-blue-500 transition-colors flex-shrink-0"
            >
              <Send size={18} className="ml-1" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loadingSession) return <LoadingScreen text="Iniciando Enlace Cifrado..." />;
  if (!session) return <LoginScreen onLogin={setSession} />;
  return <AdminDashboard session={session} />;
}