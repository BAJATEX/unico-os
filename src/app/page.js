"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, Package, Settings, ShoppingCart, Truck, 
  LogOut, ChevronDown, Plus, Search, Save, X, HelpCircle, 
  Info, MessageCircle, Megaphone, Bell, Upload, CheckCircle, DollarSign
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

  // SCANNER DE ALERTAS
  useEffect(() => {
    if (!selectedOrg || !notificationsEnabled) return;
    const runScanner = async () => {
      const { data: lowStock } = await supabase.from('products').select('name, stock').eq('org_id', selectedOrg.id).lt('stock', 5).limit(1);
      if (lowStock && lowStock.length > 0) new Notification("⚠️ STOCK BAJO", { body: `${lowStock[0].name}: Quedan ${lowStock[0].stock}`, icon: '/icon-192.png' });
      
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('org_id', selectedOrg.id).eq('status', 'paid');
      if (count > 0) new Notification("💰 PEDIDO NUEVO", { body: `Tienes ${count} pedidos por enviar.`, icon: '/icon-192.png' });
    };
    runScanner();
    const interval = setInterval(runScanner, 300000); 
    return () => clearInterval(interval);
  }, [selectedOrg, notificationsEnabled]);

  const requestNotify = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') setNotificationsEnabled(true);
  };

  if (loading) return <LoadingScreen />;
  if (!selectedOrg) return <EmptyState />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex flex-col z-20 shadow-sm relative">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-unico-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-200">U</div>
             <div><h1 className="text-lg font-extrabold text-slate-900 leading-tight">ÚNICO <span className="text-unico-600">OS</span></h1><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Commander v6.1 (70%)</p></div>
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
          <NavBtn icon={<LayoutDashboard size={20}/>} label="Finanzas (Neto)" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavBtn icon={<ShoppingCart size={20}/>} label="Pedidos y Guías" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavBtn icon={<Package size={20}/>} label="Inventario (Fotos)" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
          <NavBtn icon={<Megaphone size={20}/>} label="Marketing & Ofertas" active={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} />
          <NavBtn icon={<Settings size={20}/>} label="Configuración Web" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-6">
           {!notificationsEnabled && <button onClick={requestNotify} className="mb-4 flex items-center gap-3 text-xs font-bold text-unico-600 bg-red-50 w-full px-4 py-3 rounded-xl hover:bg-red-100 animate-pulse"><Bell size={16}/> Activar Alertas</button>}
           <button className="flex items-center gap-3 text-sm font-medium text-slate-400 hover:text-slate-600 w-full px-4 py-2 rounded-xl"><LogOut size={18}/> Salir</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative bg-slate-50/50">
        <header className="bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && 'Tu Utilidad Real (70%)'}
              {activeTab === 'marketing' && 'Gestión de Campañas'}
              {activeTab === 'orders' && 'Logística de Envíos'}
              {activeTab === 'products' && 'Catálogo de Productos'}
              {activeTab === 'settings' && 'Ajustes Técnicos'}
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

      {helpMsg && <div className="fixed bottom-6 right-6 max-w-sm bg-slate-900 text-white p-5 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 flex gap-4 items-start"><Info className="text-unico-600 shrink-0 mt-1" size={24} /><div><h4 className="font-bold text-sm mb-1 text-unico-100">Ayuda Rápida</h4><p className="text-sm leading-relaxed opacity-90">{helpMsg}</p><button onClick={() => setHelpMsg(null)} className="text-xs font-bold mt-3 hover:text-unico-600 underline">Entendido</button></div></div>}
    </div>
  );
}

// --- VISTA FINANCIERA CORREGIDA (70%) ---
function DashboardView({ orgId, setHelp }) {
  const [finance, setFinance] = useState({ gross: 0, stripe: 0, shipping: 0, net70: 0, orders: 0 });

  useEffect(() => {
    async function load() {
      const { data: orders } = await supabase.from('orders').select('*').eq('org_id', orgId).eq('status', 'paid');
      
      let gross = 0;
      let stripeFees = 0;
      let shippingCosts = 0;

      if (orders) {
        orders.forEach(o => {
          const total = o.total || 0;
          gross += total;
          
          // 1. Comisión Stripe Estimada (~4.6% + $3 IVA incluido)
          const fee = (total * 0.036) + 3; 
          const taxOnFee = fee * 0.16;
          stripeFees += (fee + taxOnFee);

          // 2. Costo Envío Estimado (Si no es pickup)
          // Asumimos promedio $220 si no hay dato exacto
          shippingCosts += 220; 
        });
      }

      // CÁLCULO DEL 70% SOBRE LA UTILIDAD BRUTA
      // (Ventas - Stripe - Envíos) * 0.70
      const netProfit100 = gross - stripeFees - shippingCosts;
      const netProfit70 = netProfit100 > 0 ? (netProfit100 * 0.70) : 0;

      setFinance({
        orders: orders?.length || 0,
        gross: gross,
        stripe: stripeFees,
        shipping: shippingCosts,
        net70: netProfit70 // ESTE ES TU DINERO REAL
      });
    }
    load();
  }, [orgId]);

  const money = (v) => `$${v.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  return (
    <div className="space-y-8">
       {/* TARJETA MAESTRA DE UTILIDAD 70% */}
       <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-unico-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
               <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">TU GANANCIA NETA (70%)</p>
               <button onClick={() => setHelp("Este monto es el 70% de la utilidad restante después de descontar comisiones de Stripe y costos de envío.")}><HelpCircle className="text-slate-500 hover:text-white"/></button>
            </div>
            <h2 className="text-5xl font-black text-white mb-6">{money(finance.net70)} <span className="text-lg text-green-400 font-medium">MXN</span></h2>
            
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-700 text-sm">
               <div>
                 <p className="text-slate-400 text-[10px] uppercase mb-1">VENTAS TOTALES</p>
                 <p className="text-lg font-bold">{money(finance.gross)}</p>
               </div>
               <div>
                 <p className="text-slate-400 text-[10px] uppercase mb-1">STRIPE & FEES (-)</p>
                 <p className="text-lg font-bold text-red-400">-{money(finance.stripe)}</p>
               </div>
               <div>
                 <p className="text-slate-400 text-[10px] uppercase mb-1">ENVÍOS (-)</p>
                 <p className="text-lg font-bold text-orange-400">-{money(finance.shipping)}</p>
               </div>
            </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
             <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><ShoppingCart/></div>
             <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Pedidos Pagados</p>
                <p className="text-2xl font-black text-slate-800">{finance.orders}</p>
             </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
             <div className="h-12 w-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><DollarSign/></div>
             <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Ticket Promedio</p>
                <p className="text-2xl font-black text-slate-800">{finance.orders > 0 ? money(finance.gross / finance.orders) : '$0.00'}</p>
             </div>
          </div>
       </div>
    </div>
  );
}

// --- GESTIÓN DE PRODUCTOS (SUBIDA FOTOS) ---
function ProductsView({ orgId, setHelp }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    supabase.from('products').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
      .then(({ data }) => setProducts(data || []));
  }, [orgId, refresh]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2"><Search className="text-slate-400" size={20}/><input type="text" placeholder="Buscar..." className="outline-none text-sm w-64"/></div>
        <button onClick={() => setShowModal(true)} className="bg-unico-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all">
          <Plus size={18}/> Nuevo Producto
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs">
            <tr><th className="px-6 py-4">Foto</th><th className="px-6 py-4">Nombre</th><th className="px-6 py-4">Precio</th><th className="px-6 py-4">Stock</th><th className="px-6 py-4 text-right">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4"><img src={p.image_url} className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200"/></td>
                <td className="px-6 py-4 font-bold text-slate-800">{p.name}<br/><span className="text-xs font-normal text-slate-400">{p.category}</span></td>
                <td className="px-6 py-4 font-mono text-slate-600">${p.price}</td>
                <td className="px-6 py-4 font-bold">{p.stock}</td>
                <td className="px-6 py-4 text-right"><span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Activo</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <CreateProductModal orgId={orgId} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); setRefresh(p => p + 1); }} setHelp={setHelp}/>}
    </div>
  );
}

// MODAL SUBIDA DE FOTOS
function CreateProductModal({ orgId, onClose, onSuccess, setHelp }) { 
  const [form, setForm] = useState({ name: '', price: '', stock: '100', category: 'BAJA_1000' });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) setImageFile(e.target.files[0]);
  };

  const submit = async (e) => { 
    e.preventDefault(); 
    setUploading(true); 

    let finalImageUrl = "/assets/logo-score.webp"; // Default

    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name.replace(/\s/g, '-')}`;
      // Subir al Bucket 'products' (debe ser público en Supabase)
      const { data, error } = await supabase.storage.from('products').upload(fileName, imageFile);
      if (error) { alert("Error foto: " + error.message); setUploading(false); return; }
      const { data: publicData } = supabase.storage.from('products').getPublicUrl(fileName);
      finalImageUrl = publicData.publicUrl;
    }

    await supabase.from('products').insert({ 
      org_id: orgId, name: form.name, price: parseFloat(form.price), stock: parseInt(form.stock), category: form.category, image_url: finalImageUrl, active: true 
    }); 
    setUploading(false); onSuccess(); 
  }; 
  
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Alta de Producto</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={submit} className="p-8 space-y-6">
          <div>
            <label className="text-sm font-bold text-slate-800 block mb-2">Foto del Producto</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-all relative">
              <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              {imageFile ? <div className="text-green-600 font-bold flex items-center gap-2"><CheckCircle size={20}/> {imageFile.name}</div> : <><Upload className="text-slate-400 mb-2" size={32}/><span className="text-sm text-slate-500">Subir Foto</span></>}
            </div>
          </div>
          <FormInput label="Nombre" placeholder="Ej. Hoodie 2026" value={form.name} onChange={v => setForm({...form, name: v})} onHelp={() => setHelp("Nombre descriptivo.")}/>
          <div>
            <label className="text-sm font-bold text-slate-800 block mb-2">Categoría</label>
            <div className="relative">
              <select className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl font-bold text-slate-700 outline-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="BAJA_1000">Baja 1000</option><option value="BAJA_500">Baja 500</option><option value="BAJA_400">Baja 400</option><option value="SF_250">San Felipe 250</option>
              </select>
              <ChevronDown className="absolute right-4 top-4 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6"><FormInput label="Precio" placeholder="0.00" value={form.price} onChange={v => setForm({...form, price: v})} onHelp={() => setHelp("Precio final.")}/><FormInput label="Stock" placeholder="100" value={form.stock} onChange={v => setForm({...form, stock: v})} onHelp={() => setHelp("Cantidad.")}/></div>
          <button type="submit" disabled={uploading} className="w-full bg-unico-600 text-white font-bold py-4 rounded-xl shadow-lg">{uploading ? 'Subiendo...' : 'GUARDAR'}</button>
        </form>
      </div>
    </div>
  ); 
}

// RESTO DE FUNCIONES (Orders, Marketing, Settings, UI) -> MANTENER IGUAL QUE VERSIÓN ANTERIOR
function OrdersView({ orgId, setHelp }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => { supabase.from('orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).then(({ data }) => setOrders(data || [])); }, [orgId]);
  const sendWhatsApp = (order) => { window.open(`https://wa.me/${order.phone || ''}?text=${encodeURIComponent(`Hola ${order.customer_name}, tu pedido #${order.id.slice(0,4)} está en proceso.`)}`, '_blank'); };
  const updateTracking = async (id) => { const guide = prompt("Guía:"); if(guide) { await supabase.from('orders').update({ tracking_number: guide, status: 'shipped' }).eq('id', id); alert("Guardado"); } };
  return (<div className="space-y-6"><div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100"><h3 className="font-bold text-slate-700">Pedidos</h3><button onClick={() => setHelp("Gestión logística.")}><HelpCircle className="text-slate-300 hover:text-unico-600"/></button></div>{orders.length === 0 ? <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"><p className="text-slate-500">Sin pedidos.</p></div> : <div className="grid gap-4">{orders.map(order => (<div key={order.id} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4"><div><p className="font-bold text-slate-800">#{order.id.slice(0,5).toUpperCase()}</p><p className="text-sm text-slate-500">{order.customer_email}</p></div><div className="flex gap-2"><button onClick={() => sendWhatsApp(order)} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs">WhatsApp</button>{order.status !== 'shipped' && <button onClick={() => updateTracking(order.id)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-xs">Guía</button>}</div></div>))}</div>}</div>);
}
function MarketingView({ orgId, setHelp }) { const [config, setConfig] = useState({}); const [saving, setSaving] = useState(false); useEffect(() => { supabase.from('site_settings').select('*').eq('org_id', orgId).single().then(({ data }) => { if(data) setConfig(data); }); }, [orgId]); const handleSave = async () => { setSaving(true); await supabase.from('site_settings').upsert({ ...config, org_id: orgId }); setTimeout(() => { setSaving(false); alert("Oferta publicada."); }, 800); }; return (<div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Cintillo de Ofertas</h3><button onClick={() => setHelp("Activa la barra amarilla.")} className="text-unico-600"><HelpCircle size={20}/></button></div><div className="space-y-6"><div className={`p-4 rounded-xl border-2 transition-all ${config.promo_active ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50'}`}><div className="flex items-center justify-between"><span className="font-bold text-slate-700">Estado de la Promoción</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={config.promo_active || false} onChange={e => setConfig({...config, promo_active: e.target.checked})} className="sr-only peer"/><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600"></div></label></div></div><FormInput label="Texto de la Oferta" placeholder="Ej. ¡ENVÍO GRATIS!" value={config.promo_text} onChange={v => setConfig({...config, promo_text: v})} onHelp={() => setHelp("Texto en la barra superior.")}/><button onClick={handleSave} disabled={saving} className="w-full bg-unico-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 shadow-md">{saving ? 'Publicando...' : 'PUBLICAR OFERTA'}</button></div></div>); }
function SettingsView({ orgId, setHelp }) { const [config, setConfig] = useState({}); const [saving, setSaving] = useState(false); useEffect(() => { supabase.from('site_settings').select('*').eq('org_id', orgId).single().then(({ data }) => { if(data) setConfig(data); }); }, [orgId]); const handleSave = async () => { setSaving(true); await supabase.from('site_settings').upsert({ ...config, org_id: orgId }); setTimeout(() => { setSaving(false); alert("Guardado"); }, 800); }; return (<div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8"><h3 className="text-xl font-bold text-slate-800 mb-8">Ajustes Web</h3><div className="space-y-8"><FormInput label="Título Portada" value={config.hero_title} onChange={v => setConfig({...config, hero_title: v})} placeholder="Ej. NUEVA COLECCIÓN"/><FormInput label="Pixel Facebook" value={config.pixel_id} onChange={v => setConfig({...config, pixel_id: v})} placeholder="Ej. 1234567890"/><button onClick={handleSave} disabled={saving} className="w-full bg-unico-600 text-white font-bold py-4 rounded-xl">{saving ? 'Guardando...' : 'GUARDAR'}</button></div></div>); }
function NavBtn({ icon, label, active, onClick }) { return <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group ${active ? 'bg-unico-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-unico-600'}`}><span className={active ? 'text-white' : 'text-slate-400 group-hover:text-unico-600'}>{icon}</span>{label}</button>; }
function FormInput({ label, desc, value, onChange, placeholder, isCode, onHelp }) { return <div className="relative"><div className="flex justify-between items-baseline mb-2"><label className="text-sm font-bold text-slate-800">{label}</label>{onHelp && <button onClick={onHelp} className="text-xs text-unico-600 font-bold hover:underline flex items-center gap-1"><HelpCircle size={12}/> Ayuda</button>}</div><input className={`w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:ring-2 focus:ring-unico-600/20 focus:border-unico-600 outline-none text-slate-700 font-bold ${isCode ? 'font-mono' : ''}`} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>{desc && <p className="text-xs text-slate-400 mt-2 ml-1">{desc}</p>}</div>; }
function LoadingScreen() { return <div className="h-screen w-screen flex flex-col items-center justify-center bg-white"><div className="h-16 w-16 bg-unico-600 rounded-2xl animate-pulse flex items-center justify-center shadow-xl mb-6"><span className="text-white font-black text-2xl">U</span></div><p className="text-sm font-bold tracking-widest text-slate-400">CARGANDO...</p></div>; }
function EmptyState() { return <div className="h-screen flex items-center justify-center text-slate-400">Error de Organización.</div>; }
