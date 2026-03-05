"use client";

import React, { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

export default function HelpTip({ title = "Ayuda", text = "", align = "right" }) {
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
          <div className="mt-2 text-sm font-semibold text-slate-800 leading-relaxed">
            {text || "—"}
          </div>
          <div className="mt-3 text-[11px] font-semibold text-slate-500">
            Tip: si algo no te cuadra, presiona “Actualizar”.
          </div>
        </div>
      ) : null}
    </span>
  );
}