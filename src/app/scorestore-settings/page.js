"use client";

import { useEffect, useMemo, useState } from "react";

const SCORESTORE_URL =
  process.env.NEXT_PUBLIC_SCORESTORE_URL || "https://scorestore.vercel.app";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const safeStr = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));

export default function ScorestoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");

  const apiBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    return "";
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("unicos_token") || "" : "";
        const res = await fetch("/api/score/site-settings", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "No se pudieron cargar los ajustes");
        }

        if (!alive) return;
        setSettings(data);
      } catch (e) {
        if (!alive) return;
        setError(String(e?.message || e || "Error desconocido"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
    } catch {}
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="hero__bg fixed inset-0 -z-10" aria-hidden="true" />
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="vfx-glass-container rounded-[28px] p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-white/70">
                Score Store Settings
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Centro de configuración conectado
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Panel alineado a Vercel para leer y actualizar ajustes públicos del ecosistema Score Store.
              </p>
            </div>

            <a
              href={SCORESTORE_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn--primary cinematic-btn neon-border justify-center"
            >
              Abrir Score Store
            </a>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                URL pública
              </div>
              <div className="mt-2 break-all text-sm font-bold text-white">
                {SCORESTORE_URL}
              </div>
              <button
                type="button"
                onClick={() => copyText(SCORESTORE_URL)}
                className="btn btn--ghost mt-4 w-full"
              >
                Copiar URL
              </button>
            </div>

            <div className="glass-panel rounded-2xl p-4 lg:col-span-2">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Estado
              </div>

              {loading ? (
                <p className="mt-3 text-sm text-white/70">Cargando ajustes…</p>
              ) : error ? (
                <p className="mt-3 text-sm font-semibold text-red-300">{error}</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/5 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                      Promo activa
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {settings?.promo_active ? "Sí" : "No"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                      Última actualización
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {safeStr(settings?.updated_at, "—")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4 sm:col-span-2">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                      Texto promo
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {safeStr(settings?.promo_text, "Sin texto activo")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}