"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Truck, RefreshCcw, PiggyBank, Activity, ExternalLink } from "lucide-react";
import HelpTip from "./HelpTip";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const moneyMXN = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num(v));

function MiniKPI({ icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</div>
        <div className="text-slate-700">{icon}</div>
      </div>
      <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
      {note ? <div className="mt-1 text-xs font-semibold text-slate-500">{note}</div> : null}
    </div>
  );
}

export default function FinanceRealPanels({ orgId, token, toast }) {
  const [busy, setBusy] = useState(false);
  const [stripe, setStripe] = useState(null);
  const [envia, setEnvia] = useState(null);

  const load = useCallback(async () => {
    if (!orgId || !token) return;
    setBusy(true);
    try {
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/stripe/summary?org_id=${encodeURIComponent(orgId)}&days=30`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/envia/summary?org_id=${encodeURIComponent(orgId)}&days=30`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const s = await sRes.json().catch(() => ({}));
      const e = await eRes.json().catch(() => ({}));

      if (!sRes.ok || !s?.ok) throw new Error(s?.error || "No se pudo leer Stripe.");
      if (!eRes.ok || !e?.ok) throw new Error(e?.error || "No se pudo leer Envía.");

      setStripe(s);
      setEnvia(e);
    } catch (err) {
      toast?.({ type: "bad", text: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  }, [orgId, token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const computed = useMemo(() => {
    const gross = num(stripe?.kpi?.gross_orders_mxn);
    const stripeFee = num(stripe?.kpi?.stripe_fee_mxn);
    const enviaCost = num(envia?.kpi?.envia_cost_mxn);

    const netReal = Math.max(0, gross - stripeFee - enviaCost);

    // ✅ regla empresa: mostrar solo 70% como “total”
    const netShown = Math.max(0, netReal * 0.7);

    return {
      gross,
      stripeFee,
      enviaCost,
      netReal,
      netShown,
      refunds: num(stripe?.kpi?.refunded_mxn),
      disputes: num(stripe?.kpi?.disputes),
    };
  }, [stripe, envia]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <PiggyBank size={14} className="text-sky-600" /> Ganancia Score Store
              </p>
              <HelpTip
                title="¿Qué significa este total?"
                text="Este total ya viene con costos descontados (Stripe + Envía). Por política interna, aquí se muestra un total conservador para operación."
              />
            </div>

            <h3 className="mt-2 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              {moneyMXN(computed.netShown)}
            </h3>

            <p className="text-sm font-semibold text-slate-600 mt-1">
              Basado en ventas pagadas + comisiones reales.
            </p>

            <p className="text-xs font-semibold text-slate-500 mt-2">
              Última actualización:{" "}
              {stripe?.updated_at ? new Date(stripe.updated_at).toLocaleString("es-MX") : "—"}
            </p>
          </div>

          <button
            onClick={load}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
          >
            <RefreshCcw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 mt-6 border-t border-slate-200">
          <MiniKPI
            label="Ventas (bruto)"
            value={moneyMXN(computed.gross)}
            icon={<Activity size={14} />}
            note="Pagadas / cumplidas"
          />
          <MiniKPI
            label="Comisión Stripe"
            value={moneyMXN(computed.stripeFee)}
            icon={<CreditCard size={14} />}
            note="Real (Stripe)"
          />
          <MiniKPI
            label="Costo Envía"
            value={moneyMXN(computed.enviaCost)}
            icon={<Truck size={14} />}
            note="Real (guías)"
          />
          <MiniKPI
            label="Neto real"
            value={moneyMXN(computed.netReal)}
            icon={<PiggyBank size={14} />}
            note="Interno"
          />
        </div>
      </div>

      {/* Stripe Panel */}
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Stripe (panel real)
              </p>
              <HelpTip
                title="Stripe (panel real)"
                text="Aquí se consulta Stripe en vivo (balance, payouts, fees). El bruto se cruza con tus órdenes para que sea tu tienda, no toda la cuenta."
              />
            </div>
            <h4 className="text-lg font-black text-slate-900 mt-1">Resumen</h4>
            <p className="text-sm font-semibold text-slate-600">
              Reembolsos (30d): {moneyMXN(computed.refunds)} · Disputas: {computed.disputes}
            </p>
          </div>

          <a
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm inline-flex items-center gap-2"
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noreferrer"
          >
            Abrir Stripe <ExternalLink size={16} />
          </a>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">
              Balance disponible
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-800 whitespace-pre-wrap">
              {(stripe?.stripe_dashboard?.balance_available || [])
                .map((x) => `${String(x.currency || "").toUpperCase()}: ${num(x.amount || 0) / 100}`)
                .join("\n") || "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">
              Payouts recientes
            </div>
            <div className="mt-2 space-y-2">
              {(stripe?.stripe_dashboard?.payouts || []).slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-800">
                    {new Date((p.created || 0) * 1000).toLocaleDateString("es-MX")} ·{" "}
                    {String(p.status || "—")}
                  </span>
                  <span className="text-slate-900 font-black">
                    {(num(p.amount || 0) / 100).toFixed(2)} {String(p.currency || "").toUpperCase()}
                  </span>
                </div>
              ))}
              {!(stripe?.stripe_dashboard?.payouts || []).length ? (
                <div className="text-sm font-semibold text-slate-500">—</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Envía Panel */}
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Envía.com (operación real)
              </p>
              <HelpTip
                title="Envía (operación real)"
                text="Se toma el costo real de guías generadas y guardadas por tu operación (shipping_labels). Es lo que de verdad pagas por envíos."
              />
            </div>
            <h4 className="text-lg font-black text-slate-900 mt-1">Guías y costos</h4>
            <p className="text-sm font-semibold text-slate-600">
              Costo total 30d: {moneyMXN(num(envia?.kpi?.envia_cost_mxn))}
            </p>
          </div>

          <span className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-sm inline-flex items-center gap-2">
            <Truck size={16} /> {num(envia?.scope?.labels_count || 0)} guías
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Carrier</th>
                <th className="py-2 pr-3">Tracking</th>
                <th className="py-2 pr-3">Costo</th>
              </tr>
            </thead>
            <tbody>
              {(envia?.labels || []).slice(0, 12).map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="py-3 pr-3 text-sm font-semibold text-slate-800">
                    {r.created_at ? new Date(r.created_at).toLocaleString("es-MX") : "—"}
                  </td>
                  <td className="py-3 pr-3 text-sm font-black text-slate-900">
                    {r.carrier || "—"}
                  </td>
                  <td className="py-3 pr-3 text-sm font-semibold text-slate-800">
                    {r.tracking || "—"}
                  </td>
                  <td className="py-3 pr-3 text-sm font-black text-slate-900">
                    {moneyMXN(num(r.total_amount_mxn))}
                  </td>
                </tr>
              ))}
              {!(envia?.labels || []).length ? (
                <tr>
                  <td colSpan={4} className="py-10 text-sm font-semibold text-slate-500">
                    Sin guías registradas en el periodo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] font-semibold text-slate-500">
          Nota: si quieres que UnicOs muestre exactamente “lo mismo que el panel de Envía”, el siguiente paso es agregar
          endpoints directos contra Envía API (shipments/tracking). Con tu endpoint real lo hacemos sin inventar rutas.
        </p>
      </div>
    </div>
  );
}