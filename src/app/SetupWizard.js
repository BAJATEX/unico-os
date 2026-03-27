"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCcw, Copy, ExternalLink } from "lucide-react";

const Row = ({ ok, label }) => (
  <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5">
    <div className="text-sm font-bold text-slate-300">{label}</div>
    {ok ? (
      <span className="inline-flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest">
        <CheckCircle2 size={16} /> Conectado
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 text-rose-400 font-black text-xs uppercase tracking-widest">
        <AlertTriangle size={16} /> Pendiente
      </span>
    )}
  </div>
);

export default function SetupWizard() {
  const [env, setEnv] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const j = await res.json();
      setEnv(j?.env || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); } catch {}
  };

  return (
    <div className="min-h-screen unicos-shell flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full unicos-card p-8 animate-unicos-slide-up">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 unicos-brand-frame p-2">
            <img src="/logo-unico.png" alt="UnicOs" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">Configuración de entorno</p>
            <h1 className="text-2xl font-black text-white">Vercel Deployment Wizard</h1>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-10 justify-center">
              <RefreshCcw className="animate-spin" size={20} />
              <span className="font-bold">Verificando variables...</span>
            </div>
          ) : env ? (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <Row ok={env.NEXT_PUBLIC_SUPABASE_URL} label="NEXT_PUBLIC_SUPABASE_URL" />
              <Row ok={env.NEXT_PUBLIC_SUPABASE_ANON_KEY} label="NEXT_PUBLIC_SUPABASE_ANON_KEY" />
              <Row ok={env.SUPABASE_SERVICE_ROLE_KEY} label="SUPABASE_SERVICE_ROLE_KEY" />
              <Row ok={env.STRIPE_SECRET_KEY} label="STRIPE_SECRET_KEY" />
              <Row ok={env.GEMINI_API_KEY} label="GEMINI_API_KEY" />
            </div>
          ) : (
            <p className="text-rose-400 font-bold text-center py-4">Error al conectar con la API de salud.</p>
          )}
        </div>

        <div className="mt-8">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Variables requeridas en Vercel Dashboard:</p>
          <div className="grid gap-2">
            {[
              "NEXT_PUBLIC_SUPABASE_URL",
              "NEXT_PUBLIC_SUPABASE_ANON_KEY",
              "SUPABASE_SERVICE_ROLE_KEY",
              "STRIPE_SECRET_KEY",
              "GEMINI_API_KEY",
              "NEXT_PUBLIC_SITE_URL"
            ].map((v) => (
              <button
                key={v}
                onClick={() => copy(v)}
                className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-sm flex items-center justify-between transition-all"
              >
                {v} <Copy size={14} className="opacity-40" />
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={load}
          className="mt-8 w-full unicos-btn py-4 bg-sky-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-sky-500/20"
        >
          Re-verificar conexión
        </button>
      </div>
    </div>
  );
}
