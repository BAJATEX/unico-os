"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, Package, Settings, ShoppingCart, Truck, 
  LogOut, ChevronDown, Plus, Search, Save, X, HelpCircle, 
  Info, MessageCircle, Megaphone, Bell 
} from 'lucide-react';

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [helpMsg, setHelpMsg] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const { data } = await supabase.from('organizations').select('*');
        if (data && data.length > 0) {
          setOrgs(data);
          const score = data.find(o => o.slug === 'score-store');
          setSelectedOrg(score || data[0]);
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          setNotificationsEnabled(true);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    init();
  }, []);

  // SCANNER DE ALERTAS INTELIGENTES (STOCK Y PEDIDOS)
  useEffect(() => {
    if (!selectedOrg || !notificationsEnabled) return;
    const runScanner = async () => {
      // Alerta de Stock
      const { data: lowStock } = await supabase.from('products').select('name, stock').eq('org_id', selectedOrg.id).lt('stock', 5).limit(1);
      if (lowStock && lowStock.length > 0) new Notification("⚠️ STOCK BAJO", { body: `${lowStock[0].name} tiene menos de 5 piezas.`, icon: '/icon-192.png' });
      // Alerta de Pedidos
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('org_id', selectedOrg.id).eq('status', 'paid');
      if (count > 0) new Notification("💰 PEDIDOS NUEVOS", { body: `Tienes ${count} pedidos por enviar.`, icon: '/icon-192.png' });
    };
    runScanner();
  }, [selectedOrg, notificationsEnabled]);

  const requestNotify = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification("🔔 Único OS", { body: "Alertas activadas." });
    }
  };

  if (loading) return <LoadingScreen />;
  if (!selectedOrg) return <EmptyState />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* SIDEBAR V4 */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex flex-col z-20 shadow-sm relative">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-unico-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-200">U</div>
             <div><h1 className="text-lg font-extrabold text-slate-900 leading-tight">ÚNICO <span className="text-unico-600">OS</span></h1><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Commander v4.0</p></div>
          </div>
        </div>
        <div className="px-6 mt-6">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Organización:</label>
          <div className="relative group">
            <select className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 outline-none" value={selectedOrg.id} onChange={(e) => setSelectedOrg(orgs.find(o => o.id === e.target.value))}>
              {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-8">
          <NavBtn icon={<LayoutDashboard size={20}/>} label="Vista General" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavBtn icon={<ShoppingCart size={20}/>} label="Pedidos y Envíos" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavBtn icon={<Package size={20}/>} label="Inventario" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
          <NavBtn icon={<Megaphone size={20}/>} label="Marketing & Ofertas" active={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} />
          <NavBtn icon={<Settings size={20}/>} label="Configuración Web" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <div className="p-6">
           {!notificationsEnabled && <button onClick={requestNotify} className="mb-4 flex items-center gap-3 text-xs font-bold text-unico-600 bg-red-50 w-full px-4 py-3 rounded-xl hover:bg-red-100 animate-pulse"><Bell size={16}/> Activar Alertas</button>}
           <button className="flex items-center gap-3 text-sm font-medium text-slate-400 hover:text-slate-600 w-full px-4 py-2 rounded-xl"><LogOut size={18}/> Salir</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto relative bg-slate-50/50">
        <header className="bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && 'Centro de Comando'}
              {activeTab === 'marketing' && 'Gestión de Campañas'}
              {activeTab === 'orders' && 'Logística'}
              {activeTab === 'products' && 'Inventario'}
              {activeTab === 'settings' && 'Ajustes'}
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mt-1">
               <div className={`h-2 w-2 rounded-full ${selectedOrg.slug === 'score-store' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
               {selectedOrg.name.toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto pb-32">
          {activeTab === 'dashboard' && <DashboardView orgId={selectedOrg.id} setHelp={setHelpMsg} />}
          {activeTab === 'orders' && <OrdersView orgId={selectedOrg.id} setHelp={setHelpMsg} />}
          {activeTab === 'products' && <ProductsView orgId={selectedOrg.id} setHelp={setHelpMsg} />}
          {activeTab === 'marketing' && <MarketingView orgId={selectedOrg.id} setHelp={setHelpMsg} />}
          {activeTab === 'settings' && <SettingsView orgId={selectedOrg.id} setHelp={setHelpMsg} />}
        </div>
      </main>

      {/* HELPER */}
      {helpMsg && <div className="fixed bottom-6 right-6 max-w-sm bg-slate-900 text-white p-5 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 flex gap-4 items-start"><Info className="text-unico-600 shrink-0 mt-1" size={24} /><div><h4 className="font-bold text-sm mb-1 text-unico-100">Ayuda Rápida</h4><p className="text-sm leading-relaxed opacity-90">{helpMsg}</p><button onClick={() => setHelpMsg(null)} className="text-xs font-bold mt-3 hover:text-unico-600 underline">Entendido</button></div></div>}
    </div>
  );
}

// --- VISTAS DEL SISTEMA ---
function DashboardView({ orgId, setHelp }) {
  const [stats, setStats] = useState({ products: 0, orders: 0 });
  useEffect(() => {
    async function load() {
      const { count: p } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
      const { count: o } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'paid');
      setStats({ products: p || 0, orders: o || 0 });
    }
    load();
  }, [orgId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard title="Pedidos por Enviar" value={stats.orders} icon={<Truck className="text-blue-600"/>} color="bg-blue-50" onHelp={() => setHelp("Pedidos pagados que aún no tienen guía.")}/>
      <StatCard title="Inventario Activo" value={stats.products} icon={<Package className="text-orange-600"/>} color="bg-orange-50" onHelp={() => setHelp("Productos visibles en la tienda.")}/>
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center"><h3 className="font-bold text-slate-800">Estado</h3><span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full mt-2">● ACTIVO</span></div>
    </div>
  );
}

function MarketingView({ orgId, setHelp }) {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { supabase.from('site_settings').select('*').eq('org_id', orgId).single().then(({ data }) => { if(data) setConfig(data); }); }, [orgId]);
  const handleSave = async () => { setSaving(true); await supabase.from('site_settings').upsert({ ...config, org_id: orgId }); setTimeout(() => { setSaving(false); alert("Oferta publicada."); }, 800); };

  return (
    <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Cintillo de Ofertas</h3><button onClick={() => setHelp("Activa la barra amarilla superior.")} className="text-unico-600"><HelpCircle size={20}/></button></div>
        <div className="space-y-6">
            <div className={`p-4 rounded-xl border-2 transition-all ${config.promo_active ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between"><span className="font-bold text-slate-700">Estado de la Promoción</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={config.promo_active || false} onChange={e => setConfig({...config, promo_active: e.target.checked})} className="sr-only peer"/><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600"></div></label></div>
            </div>
            <FormInput label="Texto de la Oferta" placeholder="Ej. ¡ENVÍO GRATIS!" value={config.promo_text} onChange={v => setConfig({...config, promo_text: v})} onHelp={() => setHelp("Texto en la barra superior.")}/>
            <button onClick={handleSave} disabled={saving} className="w-full bg-unico-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 shadow-md">{saving ? 'Publicando...' : 'PUBLICAR OFERTA'}</button>
        </div>
    </div>
  );
}

// (Mantén aquí las funciones OrdersView, ProductsView, SettingsView y componentes auxiliares que ya tenías en la V3. Solo asegúrate de que OrdersView incluya el botón de WhatsApp).
// Incluyo OrdersView V4 simplificada:
function OrdersView({ orgId, setHelp }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => { supabase.from('orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(({ data }) => setOrders(data || [])); }, [orgId]);
  const sendWhatsApp = (order) => { window.open(`https://wa.me/${order.phone || ''}?text=${encodeURIComponent(`Hola ${order.customer_name}, tu pedido #${order.id.slice(0,4)} está en proceso.`)}`, '_blank'); };
  const updateTracking = async (id) => { const guide = prompt("Guía:"); if(guide) { await supabase.from('orders').update({ tracking_number: guide, status: 'shipped' }).eq('id', id); alert("Guardado"); } };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100"><h3 className="font-bold text-slate-700">Pedidos</h3><button onClick={() => setHelp("Gestión logística.")}><HelpCircle className="text-slate-300 hover:text-unico-600"/></button></div>
       {orders.length === 0 ? <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"><p className="text-slate-500">Sin pedidos.</p></div> : <div className="grid gap-4">{orders.map(order => (
             <div key={order.id} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
               <div><p className="font-bold text-slate-800">#{order.id.slice(0,5).toUpperCase()}</p><p className="text-sm text-slate-500">{order.customer_email}</p></div>
               <div className="flex gap-2"><button onClick={() => sendWhatsApp(order)} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs">WhatsApp</button>{order.status !== 'shipped' && <button onClick={() => updateTracking(order.id)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-xs">Agregar Guía</button>}</div>
             </div>
       ))}</div>}
    </div>
  );
}

// Mantén ProductsView, SettingsView y componentes UI del mensaje anterior V3, son compatibles.
function ProductsView({ orgId, setHelp }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { supabase.from('products').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(({ data }) => setProducts(data || [])); }, [orgId, refresh]);
  return (<div className="space-y-6"><div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="flex items-center gap-2"><Search className="text-slate-400" size={20}/><input type="text" placeholder="Buscar..." className="outline-none text-sm w-64"/></div><button onClick={() => setShowModal(true)} className="bg-unico-600 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={18}/> Nuevo Producto</button></div><div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs"><tr><th className="px-6 py-4">Producto</th><th className="px-6 py-4">Precio</th><th className="px-6 py-4">Stock</th><th className="px-6 py-4 text-right">Estatus</th></tr></thead><tbody className="divide-y divide-slate-100">{products.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-bold text-slate-800">{p.name}</td><td className="px-6 py-4 text-slate-600">${p.price}</td><td className="px-6 py-4">{p.stock}</td><td className="px-6 py-4 text-right">Activo</td></tr>))}</tbody></table></div>{showModal && <CreateProductModal orgId={orgId} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); setRefresh(prev => prev + 1); }} setHelp={setHelp}/>}</div>);
}
function SettingsView({ orgId, setHelp }) { const [config, setConfig] = useState({}); const [saving, setSaving] = useState(false); useEffect(() => { supabase.from('site_settings').select('*').eq('org_id', orgId).single().then(({ data }) => { if(data) setConfig(data); }); }, [orgId]); const handleSave = async () => { setSaving(true); await supabase.from('site_settings').upsert({ ...config, org_id: orgId }); setTimeout(() => { setSaving(false); alert("Guardado"); }, 800); }; return (<div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8"><h3 className="text-xl font-bold text-slate-800 mb-8">Ajustes Web</h3><div className="space-y-8"><FormInput label="Título Portada" value={config.hero_title} onChange={v => setConfig({...config, hero_title: v})} placeholder="Ej. NUEVA COLECCIÓN"/><FormInput label="Pixel Facebook" value={config.pixel_id} onChange={v => setConfig({...config, pixel_id: v})} placeholder="Ej. 1234567890"/><button onClick={handleSave} disabled={saving} className="w-full bg-unico-600 text-white font-bold py-4 rounded-xl">{saving ? 'Guardando...' : 'GUARDAR'}</button></div></div>); }
function NavBtn({ icon, label, active, onClick }) { return <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group ${active ? 'bg-unico-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-unico-600'}`}><span className={active ? 'text-white' : 'text-slate-400 group-hover:text-unico-600'}>{icon}</span>{label}</button>; }
function StatCard({ title, value, icon, color, onHelp }) { return <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 relative"><button onClick={onHelp} className="absolute top-3 right-3 text-slate-300 hover:text-unico-600"><HelpCircle size={16}/></button><div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${color} bg-opacity-30`}>{icon}</div><div><p className="text-slate-400 text-xs font-bold uppercase">{title}</p><p className="text-3xl font-black text-slate-800 mt-1">{value}</p></div></div>; }
function FormInput({ label, desc, value, onChange, placeholder, isCode, onHelp }) { return <div className="relative"><div className="flex justify-between items-baseline mb-2"><label className="text-sm font-bold text-slate-800">{label}</label></div><input className={`w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:ring-2 focus:ring-unico-600/20 focus:border-unico-600 outline-none text-slate-700 font-bold ${isCode ? 'font-mono' : ''}`} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}/></div>; }
function CreateProductModal({ orgId, onClose, onSuccess, setHelp }) { const [form, setForm] = useState({ name: '', price: '', stock: '100' }); const submit = async (e) => { e.preventDefault(); await supabase.from('products').insert({ org_id: orgId, name: form.name, price: parseFloat(form.price), stock: parseInt(form.stock), active: true }); onSuccess(); }; return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"><div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Alta de Producto</h3><button onClick={onClose}><X size={20}/></button></div><form onSubmit={submit} className="p-8 space-y-6"><FormInput label="Nombre" value={form.name} onChange={v => setForm({...form, name: v})}/><div className="grid grid-cols-2 gap-6"><FormInput label="Precio" value={form.price} onChange={v => setForm({...form, price: v})}/><FormInput label="Stock" value={form.stock} onChange={v => setForm({...form, stock: v})}/></div><button type="submit" className="w-full bg-unico-600 text-white font-bold py-4 rounded-xl">CONFIRMAR</button></form></div></div>; }
function LoadingScreen() { return <div className="h-screen w-screen flex flex-col items-center justify-center bg-white"><div className="h-16 w-16 bg-unico-600 rounded-2xl animate-pulse flex items-center justify-center shadow-xl mb-6"><span className="text-white font-black text-2xl">U</span></div><p className="text-sm font-bold tracking-widest text-slate-400">CARGANDO...</p></div>; }
function EmptyState() { return <div className="h-screen flex items-center justify-center text-slate-400">Error de Organización.</div>; }