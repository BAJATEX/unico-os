"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Truck, RefreshCcw, PiggyBank, Activity, TrendingUp } from "lucide-react";
import HelpTip from "./HelpTip";

const moneyMXN = (v) =>
  new Intl.NumberFormat("es-MX", { 
    style: "currency", 
    currency: "MXN",
    maximumFractionDigits: 0 
  }).format(v || 0);

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

export default function FinanceRealPanels({ orgId, token }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!orgId || busy) return;
    setBusy(true);
    try {
      // RUTA CORREGIDA SEGÚN TU ESTRUCTURA:
      const res = await fetch(`/api/stripe/summary?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.ok) setData(json);
    } catch (e) {
      console.error("Finance Error:", e);
    } finally {
      setBusy(false);
    }
  }, [orgId, token, busy]);

  useEffect(() => { load(); }, [orgId]);

  const kpi = data?.kpi || {};
  const stripe = data?.stripe_dashboard || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKPI 
          label="Ventas Brutas" 
          value={moneyMXN(kpi.sales_mxn)} 
          icon={<PiggyBank size={20} />}
          note="Ingresos totales en Stripe"
        />
        <MiniKPI 
          label="Costo Envíos" 
          value={moneyMXN(kpi.envia_cost_mxn)} 
          icon={<Truck size={20} />}
          note="Gasto acumulado en guías"
        />
        <MiniKPI 
          label="Comisiones Stripe" 
          value={moneyMXN(kpi.stripe_fee_mxn)} 
          icon={<CreditCard size={20} />}
          note="Fees procesador"
        />
        <MiniKPI 
          label="Utilidad Visible" 
          value={moneyMXN(kpi.visible_profit_mxn)} 
          icon={<Activity size={20} />}
          note="Neto tras costos de operación"
          trend={true}
        />
      </div>

      <div className="unicos-card overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2">
            <CreditCard size={18} className="text-sky-400" /> Cargos Recientes (Stripe)
          </h3>
          <button onClick={load} className={`${busy ? 'animate-spin' : ''} text-slate-400 hover:text-white transition-colors`}>
            <RefreshCcw size={18} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-black/20">
                <th className="px-6 py-4">ID Cargo</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Monto Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(stripe.charges || []).map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-sky-400/70">{c.id}</td>
                  <td className="px-6 py-4">
                    <span className={`unicos-badge-${c.paid ? 'ok' : 'bad'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-white">
                    {moneyMXN(c.amount / 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
