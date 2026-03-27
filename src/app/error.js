// src/app/error.js
"use client";

import { useEffect } from "react";
import { ShieldAlert, RefreshCcw } from "lucide-react";

function hardReloadOnce() {
  try {
    if (sessionStorage.getItem("__unicos_hard_reload__") === "1") return;
    sessionStorage.setItem("__unicos_hard_reload__", "1");
  } catch {}

  window.location.reload();
}

export default function GlobalError({ error }) {
  useEffect(() => {
    const msg = String(error?.message || "");

    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.toLowerCase().includes("chunk") ||
      msg.toLowerCase().includes("chunkload")
    ) {
      hardReloadOnce();
    }
  }, [error]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--u-bg)] text-[var(--u-text)] p-6 font-sans unicos-shell">
      <div className="text-center max-w-md unicos-glass p-10 rounded-[var(--u-radius-xl)] animate-unicos-slide-up">
        <div className="w-20 h-20 unicos-glass-soft rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={40} className="text-[var(--u-teal)]" />
        </div>
        <h2 className="text-2xl font-black mb-2 tracking-tight unicos-blue-text">
          Sincronizando Sistema…
        </h2>
        <p className="text-[var(--u-text-2)] text-sm mb-8 leading-relaxed">
          Se detectó un desajuste temporal de módulos (actualización en curso). Para continuar, refresca la conexión de red.
        </p>
        <button
          onClick={hardReloadOnce}
          className="w-full unicos-btn text-white py-4 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, var(--u-blue), var(--u-teal-2))" }}
        >
          <RefreshCcw size={18} /> Refrescar Conexión
        </button>
      </div>
    </div>
  );
}
