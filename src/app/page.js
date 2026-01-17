"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, Package, Settings, ShoppingCart, 
  Building2, LogOut, ChevronDown, Plus, Search, Save, X 
} from 'lucide-react';

// --- COMPONENTE PRINCIPAL ---
export default function AdminDashboard() {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Carga inicial de datos reales
  useEffect(() => {
    async function init() {
      try {
        const { data, error } = await supabase.from('organizations').select('*');
        if (data && data.length > 0) {
          setOrgs(data);
          setSelectedOrg(data[0]);
        }
      } catch (e) {
        console.error("Error de conexión:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!selectedOrg) return <EmptyState />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* MENÚ LATERAL (SIDEBAR) */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex flex-col z-10 shadow-sm">
        <div className="p-8 pb-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            ÚNICO <span className="text-unico-600">OS</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-1">
            Plataforma Corporativa
          </p>
        </div>

        {/* Selector de Empresa */}
        <div className="px-6 mb-6">
          <div className="relative group">
            <select 
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 text-sm font-bold text-slate-700 cursor-pointer outline-none focus:ring-2 focus:ring-unico-600/20 transition-all"
              value={selectedOrg.id}
              onChange={(e) => setSelectedOrg(orgs.find(o => o.id === e.target.value))}
            >
              {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none group-hover:text-unico-600 transition-colors" size={16} />
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavBtn 
            icon={<LayoutDashboard size={18}/>} 
            label="Resumen General" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavBtn 
            icon={<Package size={18}/>} 
            label="Inventario y Productos" 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')} 
          />
          <NavBtn 
            icon={<Settings size={18}/>} 
            label="Configuración Web" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <div className="p-6 border-t border-slate-100">
          <button className="flex items-center gap-3 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors w-full">
            <LogOut size={16}/> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 overflow-y-auto relative bg-slate-50">
        {/* Barra Superior */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 px-8 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'Panel de Control'}
              {activeTab === 'products' && 'Catálogo Digital'}
              {activeTab === 'settings' && 'Ajustes de Tienda'}
            </h2>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
              <Building2 size={12}/> {selectedOrg.name}
            </div>
          </div>
          <div className="h-9 w-9 bg-unico-600 rounded-full flex items-center justify-center text-white font-bold shadow-md shadow-red-200">
            {selectedOrg.name.charAt(0)}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView orgId={selectedOrg.id} />}
          {activeTab === 'products' && <ProductsView orgId={selectedOrg.id} />}
          {activeTab === 'settings' && <SettingsView orgId={selectedOrg.id} />}
        </div>
      </main>
    </div>
  );
}

// --- VISTAS INTERNAS (MÓDULOS) ---

function DashboardView({ orgId }) {
  const [stats, setStats] = useState({ products: 0, orders: 0 });

  useEffect(() => {
    async function load() {
      const { count: p } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
      const { count: o } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
      setStats({ products: p || 0, orders: o || 0 });
    }
    load();
  }, [orgId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard title="Total Productos" value={stats.products} icon={<Package className="text-blue-600"/>} color="bg-blue-50" />
      <StatCard title="Pedidos Recientes" value={stats.orders} icon={<ShoppingCart className="text-green-600"/>} color="bg-green-50" />
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center col-span-1">
        <div className="h-10 w-10 bg-orange-50 rounded-full flex items-center justify-center mb-3">
          <Settings className="text-orange-500" size={20}/>
        </div>
        <h3 className="font-bold text-slate-800">Estado del Sistema</h3>
        <p className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full mt-2">● Operativo</p>
      </div>
    </div>
  );
}

function ProductsView({ orgId }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    supabase.from('products').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
      .then(({ data }) => setProducts(data || []));
  }, [orgId, refresh]);

  return (
    <div className="space-y-6">
      {/* Barra de Acciones */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
          <input 
            type="text" 
            placeholder="Buscar producto..." 
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:border-unico-600"
          />
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-unico-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus size={18}/> Nuevo Producto
        </button>
      </div>

      {/* Tabla Visual */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Precio</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                <td className="px-6 py-4 text-slate-600">${p.price}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${p.stock > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                    {p.stock} un.
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                  Activo
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400">No hay productos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Real para Crear Producto */}
      {showModal && (
        <CreateProductModal 
          orgId={orgId} 
          onClose={() => setShowModal(false)} 
          onSuccess={() => { setShowModal(false); setRefresh(prev => prev + 1); }} 
        />
      )}
    </div>
  );
}

function SettingsView({ orgId }) {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    supabase.from('site_settings').select('*').eq('org_id', orgId).single()
      .then(({ data }) => { if(data) setConfig(data); });
  }, [orgId]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('site_settings').upsert({ ...config, org_id: orgId });
    // Simulamos un pequeño delay para que el usuario sienta que "procesó"
    setTimeout(() => { setSaving(false); alert("✅ Cambios aplicados correctamente."); }, 800);
  };

  return (
    <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Personalización del Sitio</h3>
      
      <div className="space-y-6">
        <FormInput 
          label="Título Principal (Hero)" 
          desc="Este texto aparecerá en letras grandes en la portada."
          value={config.hero_title} 
          onChange={v => setConfig({...config, hero_title: v})}
          placeholder="Ej. BIENVENIDOS A SCORE 2026"
        />
        
        <FormInput 
          label="ID Pixel de Facebook" 
          desc="Código numérico para rastreo de ventas (Marketing)."
          value={config.pixel_id} 
          onChange={v => setConfig({...config, pixel_id: v})}
          placeholder="Ej. 1234567890"
        />

        <div className="pt-4 flex items-center justify-end">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white transition-all shadow-md ${saving ? 'bg-slate-400 cursor-wait' : 'bg-unico-600 hover:bg-red-700 hover:shadow-lg'}`}
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTES AUXILIARES Y UI KIT ---

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 mb-1 ${active ? 'bg-unico-50 text-unico-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
    >
      <span className={active ? 'text-unico-600' : 'text-slate-400'}>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:border-unico-100 transition-all">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color} bg-opacity-50`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-extrabold text-slate-800 mt-1">{value}</p>
      </div>
    </div>
  );
}

function FormInput({ label, desc, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-1">{label}</label>
      {desc && <p className="text-xs text-slate-400 mb-2">{desc}</p>}
      <input 
        className="w-full border border-slate-200 bg-slate-50 p-3 rounded-lg focus:ring-2 focus:ring-unico-600/20 focus:border-unico-600 outline-none transition-all text-slate-700 font-medium placeholder:text-slate-300"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function CreateProductModal({ orgId, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', price: '', stock: '100' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await supabase.from('products').insert({
      org_id: orgId,
      name: form.name,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      active: true
    });
    setSubmitting(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Nueva Ficha de Producto</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <FormInput label="Nombre del Producto" placeholder="Ej. Camiseta Oficial 2026" value={form.name} onChange={v => setForm({...form, name: v})} />
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Precio (MXN)" placeholder="0.00" value={form.price} onChange={v => setForm({...form, price: v})} />
            <FormInput label="Stock Inicial" placeholder="100" value={form.stock} onChange={v => setForm({...form, stock: v})} />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={submitting} className="w-full bg-unico-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-md transition-all">
              {submitting ? 'Creando...' : 'Confirmar Creación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-unico-600">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-unico-600 mb-4"></div>
      <p className="text-sm font-semibold tracking-wide animate-pulse">CARGANDO ÚNICO OS...</p>
    </div>
  );
}

function EmptyState() {
  return <div className="h-screen flex items-center justify-center">Error: No se encontró la organización.</div>;
}
