"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createClient } from "@supabase/supabase-js";
import {
  Activity,
  Boxes,
  Clock,
  CreditCard,
  ExternalLink,
  HelpCircle,
  LogOut,
  Package,
  PiggyBank,
  Receipt,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Wallet,
  X,
} from "lucide-react";

/**
 * =========================================================
 * UnicOs Admin — src/app/page.js
 * Repo: unico-os-main.zip (actual)
 * Objetivo:
 * - Dashboard REAL: Stripe + Envía (vía /api/stripe/summary y /api/envia/summary)
 * - KPIs entendibles + tooltips (❓)
 * - Mantener regla empresa: mostrar solo 70% del neto real como "total"
 * =========================================================
 */

// -----------------------------
// Helpers
// -----------------------------
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const moneyMXN = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num(v));

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const safeJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// -----------------------------
// Supabase (client)
// -----------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Nota: Supabase client-side solo con ANON KEY (RLS manda)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
});

// -----------------------------
// UI — Toast
// -----------------------------
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((t) => {
    setToast(t);
    window.clearTimeout(show._t);
    show._t = window.setTimeout(() => setToast(null), 3200);
  }, []);
  return { toast, show };
}

function Toast({ toast }) {
  if (!toast) return null;
  const kind = toast.type || "ok";
  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      <div
        className={clsx(
          "rounded-2xl border shadow-lg px-4 py-3 text-sm font-semibold max-w-[86vw]",
          kind === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        )}
      >
        {toast.text || "—"}
      </div>
    </div>
  );
}

// -----------------------------
// UI — HelpTip (❓)
// -----------------------------
function HelpTip({ title = "Ayuda", text = "", align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
        aria-label="Ayuda"
        title="¿Qué es esto?"
      >
        <HelpCircle size={16} className="text-slate-600" />
      </button>

      {open ? (
        <div
          className={[
            "absolute z-[9999] mt-2 w-[320px] max-w-[85vw] rounded-2xl border border-slate-200 bg-white shadow-xl p-4",
            align === "left" ? "left-0" : "right-0",
          ].join(" ")}
          role="dialog"
          aria-label={title}
        >
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</div>
          <div className="mt-2 text-sm font-semibold text-slate-800 leading-relaxed">{text || "—"}</div>
          <div className="mt-3 text-[11px] font-semibold text-slate-500">
            Tip: si algo no te cuadra, presiona “Actualizar”.
          </div>
        </div>
      ) : null}
    </span>
  );
}

// -----------------------------
// UI — Mini KPI
// -----------------------------
function MiniKPI({ label, value, note, icon, helpTitle, helpText }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</div>
          {helpTitle || helpText ? <HelpTip title={helpTitle || "Ayuda"} text={helpText || ""} /> : null}
        </div>
        <div className="text-slate-700">{icon}</div>
      </div>
      <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
      {note ? <div className="mt-1 text-xs font-semibold text-slate-500">{note}</div> : null}
    </div>
  );
}

// -----------------------------
// Auth helpers
// -----------------------------
async function apiFetch(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
      "Cache-Control": "no-store",
    },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    throw new Error(j?.error || "Error de servidor");
  }
  return j;
}

// -----------------------------
// AI Dock (placeholder UX)
// -----------------------------
function AiDock() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asistente</p>
          <p className="text-sm font-black text-slate-900 mt-1">NOVA (modo admin)</p>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            Pronto: acciones rápidas, monitoreo y reportes automáticos.
          </p>
        </div>
        <Sparkles size={18} className="text-sky-600" />
      </div>
    </div>
  );
}

// -----------------------------
// DashboardView — REAL Stripe + Envía + 70% rule
// -----------------------------
function DashboardView({ orgId, token, toast }) {
  const [busy, setBusy] = useState(false);

  const [stripeDash, setStripeDash] = useState(null);
  const [enviaDash, setEnviaDash] = useState(null);

  const load = useCallback(async () => {
    if (!orgId || !token) return;
    setBusy(true);
    try {
      const [s, e] = await Promise.all([
        apiFetch(`/api/stripe/summary?org_id=${encodeURIComponent(orgId)}&days=30`, token),
        apiFetch(`/api/envia/summary?org_id=${encodeURIComponent(orgId)}&days=30`, token),
      ]);
      setStripeDash(s);
      setEnviaDash(e);
    } catch (err) {
      toast?.({ type: "bad", text: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  }, [orgId, token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const kpi = useMemo(() => {
    const gross = num(stripeDash?.kpi?.gross_orders_mxn);
    const stripeFee = num(stripeDash?.kpi?.stripe_fee_mxn);
    const enviaCost = num(enviaDash?.kpi?.envia_cost_mxn);

    const netReal = Math.max(0, gross - stripeFee - enviaCost);

    // ✅ regla estricta empresa: mostrar SOLO 70% como “total”
    const netShown = Math.max(0, netReal * 0.7);

    return {
      gross,
      stripeFee,
      enviaCost,
      netReal,
      netShown,
      refunds: num(stripeDash?.kpi?.refunded_mxn),
      disputes: num(stripeDash?.kpi?.disputes),
      updatedAt: stripeDash?.updated_at || null,
    };
  }, [stripeDash, enviaDash]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Sparkles size={14} className="text-sky-600" /> Ganancia Score Store
              </p>
              <HelpTip
                title="¿Qué significa este total?"
                text="Este total ya viene con costos descontados (Stripe + Envía). Por política interna, aquí se muestra un total conservador para operación."
              />
            </div>

            <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">
              {moneyMXN(kpi.netShown)}
            </h3>

            <p className="text-sm font-semibold text-slate-600 mt-1">
              Basado en ventas pagadas + comisiones reales.
            </p>

            <p className="text-xs font-semibold text-slate-500 mt-2">
              {kpi.updatedAt ? `Última actualización: ${new Date(kpi.updatedAt).toLocaleString("es-MX")}` : "—"}
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
            value={moneyMXN(kpi.gross)}
            note="Pagadas / cumplidas"
            icon={<Wallet size={14} />}
            helpTitle="Ventas (bruto)"
            helpText="Suma total de pedidos pagados o cumplidos en el periodo seleccionado."
          />
          <MiniKPI
            label="Comisión Stripe"
            value={moneyMXN(kpi.stripeFee)}
            note="Real (Stripe)"
            icon={<CreditCard size={14} />}
            helpTitle="Comisión Stripe"
            helpText="Costo real calculado desde Stripe (fees)."
          />
          <MiniKPI
            label="Costo Envía"
            value={moneyMXN(kpi.enviaCost)}
            note="Real (guías)"
            icon={<Truck size={14} />}
            helpTitle="Costo Envía"
            helpText="Costo total real de guías generadas y registradas (shipping_labels)."
          />
          <MiniKPI
            label="Neto real"
            value={moneyMXN(kpi.netReal)}
            note="Interno"
            icon={<PiggyBank size={14} />}
            helpTitle="Neto real"
            helpText="Bruto menos comisiones de Stripe y Envía. (Este número es interno)."
          />
        </div>
      </div>
{/* Stripe Panel */}
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stripe (panel real)</p>
              <HelpTip
                title="Stripe (panel real)"
                text="Aquí se consulta Stripe en vivo (balance, payouts, fees). El bruto se cruza con tus órdenes para que sea tu tienda, no toda la cuenta."
              />
            </div>
            <h4 className="text-lg font-black text-slate-900 mt-1">Resumen</h4>
            <p className="text-sm font-semibold text-slate-600">
              Reembolsos (30d): {moneyMXN(kpi.refunds)} · Disputas: {kpi.disputes}
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
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Balance disponible</div>
            <div className="mt-2 text-sm font-semibold text-slate-800 whitespace-pre-wrap">
              {(stripeDash?.stripe_dashboard?.balance_available || [])
                .map((x) => `${String(x.currency || "").toUpperCase()}: ${num(x.amount || 0) / 100}`)
                .join("\n") || "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Payouts recientes</div>
            <div className="mt-2 space-y-2">
              {(stripeDash?.stripe_dashboard?.payouts || []).slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-800">
                    {new Date((p.created || 0) * 1000).toLocaleDateString("es-MX")} · {String(p.status || "—")}
                  </span>
                  <span className="text-slate-900 font-black">
                    {(num(p.amount || 0) / 100).toFixed(2)} {String(p.currency || "").toUpperCase()}
                  </span>
                </div>
              ))}
              {!(stripeDash?.stripe_dashboard?.payouts || []).length ? (
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
              Costo total 30d: {moneyMXN(num(enviaDash?.kpi?.envia_cost_mxn))}
            </p>
          </div>

          <span className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-sm inline-flex items-center gap-2">
            <Truck size={16} /> {num(enviaDash?.scope?.labels_count || 0)} guías
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
              {(enviaDash?.labels || []).slice(0, 12).map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="py-3 pr-3 text-sm font-semibold text-slate-800">
                    {r.created_at ? new Date(r.created_at).toLocaleString("es-MX") : "—"}
                  </td>
                  <td className="py-3 pr-3 text-sm font-black text-slate-900">{r.carrier || "—"}</td>
                  <td className="py-3 pr-3 text-sm font-semibold text-slate-800">{r.tracking || "—"}</td>
                  <td className="py-3 pr-3 text-sm font-black text-slate-900">{moneyMXN(num(r.total_amount_mxn))}</td>
                </tr>
              ))}
              {!(enviaDash?.labels || []).length ? (
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

// -----------------------------
// ProductsView — Gestión real
// -----------------------------
function ProductsView({ orgId, canWrite, toast }) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const emptyForm = useMemo(
    () => ({
      name: "",
      sku: "",
      description: "",
      price_mxn: "",
      stock: "",
      section_id: "EDICION_2025",
      rank: "999",
      is_active: true,
      sizes_csv: "S,M,L,XL,XXL",
      images_lines: "",
      image_url: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!orgId) return;

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, sku, description, price_mxn, price_cents, stock, section_id, rank, images, sizes, image_url, is_active, deleted_at, created_at"
        )
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("rank", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(400);

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return rows || [];
    return (rows || []).filter((r) => {
      const t = `${r?.name || ""} ${r?.sku || ""} ${r?.section_id || ""}`.toLowerCase();
      return t.includes(s);
    });
  }, [rows, q]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    const sizes = Array.isArray(row?.sizes) ? row.sizes.join(",") : "";
    const images = Array.isArray(row?.images) ? row.images.join("\n") : "";
    setForm({
      name: row?.name || "",
      sku: row?.sku || "",
      description: row?.description || "",
      price_mxn: String(row?.price_mxn ?? ""),
      stock: String(row?.stock ?? ""),
      section_id: row?.section_id || "EDICION_2025",
      rank: String(row?.rank ?? "999"),
      is_active: !!row?.is_active,
      sizes_csv: sizes || "S,M,L,XL,XXL",
      images_lines: images || "",
      image_url: row?.image_url || "",
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!orgId) return;

    if (!canWrite) {
      toast?.({ type: "bad", text: "No tienes permisos para editar productos." });
      return;
    }

    const name = String(form.name || "").trim();
    const sku = String(form.sku || "").trim();
    if (!name) return toast?.({ type: "bad", text: "Falta el nombre del producto." });
    if (!sku) return toast?.({ type: "bad", text: "Falta el SKU." });

    const price_mxn = Number(form.price_mxn);
    if (!Number.isFinite(price_mxn) || price_mxn <= 0) {
      return toast?.({ type: "bad", text: "Precio MXN inválido." });
    }

    const stock = Number(form.stock);
    const section_id = String(form.section_id || "EDICION_2025").trim() || "EDICION_2025";
    const rank = Number(form.rank);

    const sizes = String(form.sizes_csv || "")
      .split(",")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    const images = String(form.images_lines || "")
      .split("\n")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    const image_url = String(form.image_url || "").trim() || (images[0] || null);

    const payload = {
      organization_id: orgId,
      name,
      sku,
      description: String(form.description || "").trim(),
      price_mxn,
      price_cents: Math.round(price_mxn * 100),
      stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
      section_id,
      rank: Number.isFinite(rank) ? rank : 999,
      is_active: !!form.is_active,
      images: images.length ? images : null,
      sizes: sizes.length ? sizes : null,
      image_url,
      updated_at: new Date().toISOString(),
    };

    setBusy(true);
    try {
      if (editing?.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast?.({ type: "ok", text: "Producto actualizado." });
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
        toast?.({ type: "ok", text: "Producto creado." });
      }

      closeModal();
      load();
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const softDelete = async (row) => {
    if (!row?.id) return;

    if (!canWrite) {
      toast?.({ type: "bad", text: "No tienes permisos para eliminar productos." });
      return;
    }

    const ok = confirm(`¿Eliminar "${row?.name || row?.sku || "producto"}"? (Se puede recuperar reactivando)`);
    if (!ok) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;

      toast?.({ type: "ok", text: "Producto eliminado (soft-delete)." });
      load();
    } catch (e) {
      toast?.({ type: "bad", text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Catálogo</p>
            <HelpTip
              title="¿Qué controla esta sección?"
              text="Estos productos alimentan Score Store en vivo (Netlify Functions → Supabase). Cambios aquí se reflejan cuando Score Store vuelve a cargar catálogo."
            />
          </div>
          <h4 className="text-lg font-black text-slate-900">Productos (en vivo)</h4>
          <p className="text-sm font-semibold text-slate-600">
            Estos datos alimentan Score Store en tiempo real (Netlify Functions → Supabase).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white">
            <Search size={16} className="text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre / SKU / sección…"
              className="outline-none text-sm font-semibold text-slate-800 w-[240px] max-w-full"
            />
          </div>

          <button
            onClick={load}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm flex items-center gap-2"
          >
            <RefreshCcw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
          </button>

          <button
            onClick={openNew}
            disabled={!canWrite}
            className={clsx(
              "px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-2",
              canWrite ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed"
            )}
          >
            <Package size={16} /> Nuevo
          </button>
        </div>
      </div>
<div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
              <th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Sección</th>
              <th className="py-2 pr-3">Precio</th>
              <th className="py-2 pr-3">Stock</th>
              <th className="py-2 pr-3">Activo</th>
              <th className="py-2 pr-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {(filtered || []).map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex items-center justify-center">
                      {r?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image_url} alt={r.name || "Producto"} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs font-black text-slate-400">IMG</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{r?.name || "—"}</p>
                      <p className="text-xs font-semibold text-slate-500 truncate">Rank: {String(r?.rank ?? "—")}</p>
                    </div>
                  </div>
                </td>

                <td className="py-3 pr-3">
                  <p className="text-sm font-black text-slate-900">{r?.sku || "—"}</p>
                </td>

                <td className="py-3 pr-3">
                  <p className="text-sm font-black text-slate-900">{r?.section_id || "—"}</p>
                </td>

                <td className="py-3 pr-3">
                  <p className="text-sm font-black text-slate-900">{moneyMXN(r?.price_mxn || 0)}</p>
                </td>

                <td className="py-3 pr-3">
                  <p className="text-sm font-black text-slate-900">{Number(r?.stock ?? 0)}</p>
                </td>

                <td className="py-3 pr-3">
                  <span
                    className={clsx(
                      "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black",
                      r?.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {r?.is_active ? "Sí" : "No"}
                  </span>
                </td>

                <td className="py-3 pr-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      disabled={!canWrite}
                      className={clsx(
                        "px-3 py-2 rounded-2xl font-black text-sm border",
                        canWrite
                          ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                          : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => softDelete(r)}
                      disabled={!canWrite}
                      className={clsx(
                        "px-3 py-2 rounded-2xl font-black text-sm border",
                        canWrite
                          ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                          : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!filtered?.length ? (
              <tr>
                <td colSpan={7} className="py-10">
                  <p className="text-sm font-semibold text-slate-500">Sin productos.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} role="button" aria-label="Cerrar modal" />
          <div className="relative w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white shadow-xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {editing?.id ? "Editar" : "Nuevo"} producto
                </p>
                <h4 className="text-lg font-black text-slate-900">
                  {editing?.id ? editing?.name || "Producto" : "Crear producto"}
                </h4>
              </div>

              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Nombre</label>
                  <HelpTip title="Nombre" text="Nombre visible para el cliente en Score Store." />
                </div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">SKU</label>
                  <HelpTip title="SKU" text="Identificador único. Score Store lo usa para cobrar y para el carrito." />
                </div>
                <input
                  value={form.sku}
                  onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Precio MXN</label>
                  <HelpTip title="Precio" text="Precio en MXN. Se guarda también como centavos para Stripe (price_cents)." />
                </div>
                <input
                  value={form.price_mxn}
                  onChange={(e) => setForm((p) => ({ ...p, price_mxn: e.target.value }))}
                  inputMode="decimal"
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
                <p className="text-[11px] font-semibold text-slate-500 mt-1">Stripe usa centavos automáticamente.</p>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Stock</label>
                  <HelpTip title="Stock" text="Cantidad disponible. Si no llevas stock estricto, déjalo en 0 y controla por WhatsApp." />
                </div>
                <input
                  value={form.stock}
                  onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                  inputMode="numeric"
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Sección (section_id)</label>
                  <HelpTip title="Sección" text="Define en qué colección aparece (Ej: EDICION_2025, BAJA_500, etc.)." />
                </div>
                <input
                  value={form.section_id}
                  onChange={(e) => setForm((p) => ({ ...p, section_id: e.target.value }))}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Rank (orden)</label>
                  <HelpTip title="Rank" text="Orden de aparición. Menor número = aparece primero." />
                </div>
                <input
                  value={form.rank}
                  onChange={(e) => setForm((p) => ({ ...p, rank: e.target.value }))}
                  inputMode="numeric"
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Descripción</label>
                  <HelpTip title="Descripción" text="Texto que ve el cliente al abrir el producto." />
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Tallas (CSV)</label>
                  <HelpTip title="Tallas" text="Separadas por comas. Ej: S,M,L,XL,XXL" />
                </div>
                <input
                  value={form.sizes_csv}
                  onChange={(e) => setForm((p) => ({ ...p, sizes_csv: e.target.value }))}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Imagen principal (URL)</label>
                  <HelpTip title="Imagen principal" text="La imagen que aparece primero en Score Store." />
                </div>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700">Imágenes (1 URL por línea)</label>
                  <HelpTip
                    title="Galería"
                    text="Una URL por línea. Score Store las usa para el carrusel del producto."
                    align="left"
                  />
                </div>
                <textarea
                  value={form.images_lines}
                  onChange={(e) => setForm((p) => ({ ...p, images_lines: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 outline-none"
                  placeholder={"https://.../img1.webp\nhttps://.../img2.webp"}
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  Activo
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={save}
                    disabled={busy}
                    className={clsx(
                      "px-4 py-3 rounded-2xl font-black text-sm",
                      busy ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] font-semibold text-slate-500 mt-4">
              Nota: Score Store consume estos datos vía <code>/.netlify/functions/catalog</code> y valida precios en el checkout.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------
// Placeholder modules (sin romper)
// -----------------------------
function PlaceholderView({ title, icon, text, cta }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Módulo</p>
          <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
            {icon} {title}
          </h4>
          <p className="text-sm font-semibold text-slate-600 mt-2">{text}</p>
        </div>
        {cta ? <div>{cta}</div> : null}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-black uppercase tracking-widest text-slate-500">Estado</div>
        <div className="mt-2 text-sm font-semibold text-slate-700">Listo para ampliar cuando tú lo pidas.</div>
      </div>
    </div>
  );
}

function MarketingView() {
  return (
    <PlaceholderView
      title="Marketing"
      icon={<Sparkles size={16} className="text-sky-600" />}
      text="Aquí vivirán: promociones, códigos, campañas y automatizaciones."
    />
  );
}

function SettingsView() {
  return (
    <PlaceholderView
      title="Settings"
      icon={<Settings size={16} className="text-slate-700" />}
      text="Configuración general del sistema."
      cta={
        <a
          href="/scorestore-settings"
          className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm inline-flex items-center gap-2"
        >
          Abrir Score Store Settings <ExternalLink size={16} />
        </a>
      }
    />
  );
}

function SecurityView() {
  return (
    <PlaceholderView
      title="Seguridad"
      icon={<ShieldCheck size={16} className="text-emerald-600" />}
      text="Roles, accesos y auditoría."
    />
  );
}

// -----------------------------
// Main App
// -----------------------------
export default function Page() {
  const { toast, show } = useToast();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState("");
  const [canWrite, setCanWrite] = useState(false);

  const [active, setActive] = useState("dashboard");

  // Session bootstrap
  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sess = data?.session || null;
        if (!sess?.access_token) {
          setReady(true);
          return;
        }

        if (!mounted) return;

        setToken(sess.access_token);
        setUser(sess.user || null);

        // Load org from your backend (real)
        const j = await apiFetch("/api/me", sess.access_token);
        setOrgId(j?.org_id || "");
        setRole(j?.role || "");
        setCanWrite(!!j?.can_write);
      } catch (e) {
        // silent
      } finally {
        if (mounted) setReady(true);
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setToken("");
      setUser(null);
      setOrgId("");
      setRole("");
      setCanWrite(false);
      setActive("dashboard");
      show({ type: "ok", text: "Sesión cerrada." });
    } catch {
      show({ type: "bad", text: "No se pudo cerrar sesión." });
    }
  };

  const tabs = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard", icon: <Activity size={16} /> },
      { id: "products", label: "Productos", icon: <Boxes size={16} /> },
      { id: "marketing", label: "Marketing", icon: <Sparkles size={16} /> },
      { id: "settings", label: "Settings", icon: <Settings size={16} /> },
      { id: "security", label: "Seguridad", icon: <ShieldCheck size={16} /> },
    ],
    []
  );

  const view = useMemo(() => {
    if (!orgId) {
      return (
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-sm font-semibold text-slate-700">
            {ready ? "Inicia sesión para continuar." : "Cargando sesión…"}
          </p>
        </div>
      );
    }

    if (active === "products") return <ProductsView orgId={orgId} canWrite={canWrite} toast={show} />;
    if (active === "marketing") return <MarketingView />;
    if (active === "settings") return <SettingsView />;
    if (active === "security") return <SecurityView />;
    return <DashboardView orgId={orgId} token={token} toast={show} />;
  }, [active, orgId, canWrite, token, ready, show]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast toast={toast} />

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">UnicOs</p>
            <h1 className="text-lg font-black text-slate-900 truncate">Panel maestro de operaciones</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-white">
              <Clock size={16} className="text-slate-500" />
              <span className="text-sm font-black text-slate-900">
                {new Date().toLocaleDateString("es-MX")}
              </span>
            </div>

            <button
              onClick={logout}
              className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-sm inline-flex items-center gap-2"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>
<div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Sidebar */}
        <aside className="md:col-span-3 lg:col-span-2 space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Navegación</p>

            <nav className="space-y-2">
              {tabs.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActive(it.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm",
                    active === it.id ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50 text-slate-900"
                  )}
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
            </nav>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rol</p>
              <p className="text-sm font-black text-slate-900 mt-1">{role || "—"}</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">
                Organización: <span className="font-black">{orgId.slice(0, 8)}…</span>
              </p>
            </div>
          </div>

          <div className="mt-4">
            <AiDock />
          </div>
        </aside>

        {/* Main */}
        <main className="md:col-span-9 lg:col-span-10 space-y-4">{view}</main>
      </div>
    </div>
  );
}