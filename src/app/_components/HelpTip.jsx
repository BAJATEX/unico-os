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
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
        aria-label="Ayuda"
      >
        <HelpCircle size={14} className="text-sky-400" />
      </button>

      {open && (
        <div
          className={`absolute z-[100] mt-2 w-[280px] unicos-card p-4 animate-unicos-slide-up shadow-2xl ${
            align === "left" ? "left-0" : "right-0"
          }`}
          role="dialog"
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-2">{title}</div>
          <div className="text-sm font-medium text-slate-300 leading-relaxed">{text}</div>
        </div>
      )}
    </span>
  );
}
