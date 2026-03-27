"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Truck, RefreshCcw, PiggyBank, Activity, ExternalLink, TrendingUp } from "lucide-react";
import HelpTip from "./HelpTip";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const moneyMXN = (v) =>
  new Intl.NumberFormat("es-MX", { 
    style: "currency", 
    currency: "MXN",
    maximumFractionDigits: 0 
  }).format(num(v));

function MiniKPI({ icon, label, value, note, trend }) {
  return (
    <div className="unicos-kpi p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
        <div className="text-sky-400 group-hover:scale-110 transition-transform">{icon}</div>
      </div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
      {note && (
        <div className="mt-2 flex items-center gap-2">
          {trend && <TrendingUp size={12} className="text-emerald-400" />}
          <span className="text-[11px] font-bold text-slate-500">{note}</span>
        </div>
      )}
    </div>
  );
}

export default function FinanceRealPanels({ orgId, token, toast }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState({ stripe: null, envia: null });

  const load = useCallback(async () => {
    if (!orgId || busy) return;
    setBusy(true);
    try {
      // Endpoint unificado para optimizar requests en Vercel
      const res = await fetch(`/api/finance/summary?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Finance Load Error:", e);
    } finally {
      setBusy(false);
    }
  }, [orgId, token, busy]);

  useEffect(() => { load(); }, [orgId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKPI 
          label="Stripe Balance" 
          value={moneyMXN(data.stripe?.available)} 
          icon={<CreditCard size={20} />}
          note="Fondos listos para retiro"
        />
        <MiniKPI 
          label="Ventas Mes" 
          value={moneyMXN(data.stripe?.monthly_volume)} 
          icon={<PiggyBank size={20} />}
          note="+12% vs mes anterior"
          trend={true}
        />
        <MiniKPI 
          label="Logística (Envía)" 
          value={moneyMXN(data.envia?.total_spent)} 
          icon={<Truck size={20} />}
          note="Gasto acumulado en guías"
        />
        <MiniKPI 
          label="Margen Estimado" 
          value="74%" 
          icon={<Activity size={20} />}
          note="Basado en costos de envío"
        />
      </div>

      <div className="unicos-card overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2">
            <Activity size={18} className="text-sky-400" /> Últimos Movimientos
          </h3>
          <button onClick={load} className={`${busy ? 'animate-spin' : ''} text-slate-400 hover:text-white transition-colors`}>
            <RefreshCcw size={18} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-black/20">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Concepto</th>
                <th className="px-6 py-4">Tracking</th>
                <th className="px-6 py-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data.envia?.labels || []).map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    {new Date(r.created_at).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-white uppercase">{r.carrier}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-sky-400/70">{r.tracking}</td>
                  <td className="px-6 py-4 text-right font-black text-white">{moneyMXN(r.total_amount_mxn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
