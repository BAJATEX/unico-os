"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import clsx from "clsx";
import { Bot, Sparkles, Send, X, ChevronDown, RefreshCcw, History, Search } from "lucide-react";

const BRAND = {
  primaryLogo: "/logo-unico.png",
  fallbackLogo: "/icon-512.png",
  grad: "linear-gradient(135deg, var(--u-blue), var(--u-teal))",
};

const clamp = (v, n = 2000) => String(v ?? "").trim().slice(0, n);
const normEmail = (s) => String(s || "").trim().toLowerCase();

export default function AiDock() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat"); // chat | activity

  const [session, setSession] = useState(null);
  const token = session?.access_token || "";
  const email = normEmail(session?.user?.email);

  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState("");

  const [busy, setBusy] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const [messages, setMessages] = useState([
    { role: "assistant", content: "Sistema en línea. Dime qué necesitas optimizar hoy." },
  ]);
  const [input, setInput] = useState("");

  // Activity
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [auditQ, setAuditQ] = useState("");

  const bottomRef = useRef(null);
  const [logoSrc, setLogoSrc] = useState(BRAND.primaryLogo);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    let unsub = null;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);

      const { data: sub } = await supabase.auth.onAuthStateChange((_e, s) =>
        setSession(s || null)
      );
      unsub = sub?.subscription || null;
    })();

    return () => unsub?.unsubscribe?.();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!email) {
        setOrgs([]);
        setOrgId("");
        return;
      }

      setLoadingOrgs(true);
      try {
        const { data: mems } = await supabase
          .from("admin_users")
          .select("organization_id, role")
          .ilike("email", email)
          .eq("is_active", true);

        const ids = Array.from(new Set((mems || []).map((m) => m.organization_id).filter(Boolean)));
        if (!ids.length) {
          setOrgs([]);
          setOrgId("");
          return;
        }

        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .in("id", ids)
          .order("name");

        const list = orgData || [];
        setOrgs(list);

        const preferScore =
          list.find((o) => String(o.slug || o.name || "").toLowerCase().includes("score")) || list[0];
        setOrgId(preferScore?.id || "");
      } finally {
        setLoadingOrgs(false);
      }
    };

    run();
  }, [email]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const canUse = Boolean(token && email && orgId);

  const quickActions = useMemo(
    () => [
      { label: "Resumen ventas", prompt: "Resumen ventas" },
      { label: "Top clientes", prompt: "Top clientes" },
      { label: "Envíos pendientes", prompt: "Envíos pendientes" },
      { label: "Activar promo", prompt: 'Activa promo: "ENVÍO GRATIS A TODO MÉXICO 🚚🔥"' },
    ],
    []
  );

  const send = async (text) => {
    const msg = clamp(text);
    if (!msg) return;

    if (!canUse) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Autenticación requerida: falta sesión u organización." },
      ]);
      return;
    }

    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, organization_id: orgId }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Error de red IA.");

      setMessages((m) => [...m, { role: "assistant", content: j?.reply || "Comando ejecutado con éxito." }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error de Sistema: ${String(e?.message || e)}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const loadAudit = async () => {
    if (!canUse) return;
    setAuditBusy(true);
    try {
      const res = await fetch(`/api/audit/list?org_id=${encodeURIComponent(orgId)}&limit=120`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Desincronización de actividad.");
      setAuditRows(j.rows || []);
    } catch {
      setAuditRows([]);
    } finally {
      setAuditBusy(false);
    }
  };

  useEffect(() => {
    if (open && view === "activity") loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, orgId]);

  const filteredAudit = useMemo(() => {
    const q = auditQ.trim().toLowerCase();
    if (!q) return auditRows;
    return (auditRows || []).filter((r) => {
      const hay = `${r.action || ""} ${r.actor_email || ""} ${r.summary || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [auditRows, auditQ]);

  if (!session) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setView("chat"); }}
        className="fixed bottom-6 right-6 z-[80] px-5 py-3 rounded-2xl text-white font-black text-sm flex items-center gap-2 unicos-btn animate-unicos-float shadow-2xl hover:scale-105"
        style={{
          background: BRAND.grad,
          paddingBottom: "max(12px, calc(12px + env(safe-area-inset-bottom)))",
          border: "1px solid rgba(255,255,255,0.2)"
        }}
        aria-label="Abrir Terminal IA"
        title="Unico IA"
      >
        <Sparkles size={18} />
        IA
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-[var(--u-bg)]/80 backdrop-blur-md p-4 flex items-end md:items-center justify-center unicos-shell">
          <div className="w-full max-w-2xl unicos-panel animate-unicos-slide-up flex flex-col h-[85vh] md:h-auto md:max-h-[90vh]">
            
            {/* HEADER */}
            <div className="p-5 border-b border-[var(--u-border)] flex items-center justify-between bg-[var(--u-panel-strong)] relative z-10">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-[18px] unicos-glass-soft flex items-center justify-center">
                  <img
                    src={logoSrc}
                    alt="UnicOs"
                    className="w-full h-full object-contain p-2 drop-shadow-md"
                    onError={() => { if (logoSrc !== BRAND.fallbackLogo) setLogoSrc(BRAND.fallbackLogo); }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-[var(--u-text)] flex items-center gap-2 text-lg">
                    <Bot size={18} className="text-[var(--u-teal)]" /> Unico IA
                  </p>
                  <p className="text-xs font-semibold text-[var(--u-text-3)] truncate tracking-wide">
                    {email || "Módulo Central"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="p-2.5 rounded-xl unicos-glass-soft text-[var(--u-text-2)] hover:text-white transition-colors"
                aria-label="Cerrar Terminal"
              >
                <X size={20} />
              </button>
            </div>

            {/* TOOLBAR */}
            <div className="p-4 border-b border-[var(--u-border)] bg-[var(--u-panel)] flex flex-col md:flex-row gap-4 md:items-center md:justify-between relative z-10">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className="appearance-none unicos-input py-2 pl-4 pr-10 text-xs font-black cursor-pointer"
                    disabled={loadingOrgs || !orgs.length}
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id} className="bg-[var(--u-bg)]">{o.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 text-[var(--u-text-3)] pointer-events-none" size={16} />
                </div>

                <div className="flex gap-2 p-1 unicos-glass-soft rounded-[20px]">
                  <button
                    onClick={() => setView("chat")}
                    className={clsx(
                      "px-4 py-2 rounded-[16px] font-black text-xs transition-all",
                      view === "chat" ? "text-white shadow-md" : "text-[var(--u-text-3)] hover:text-white"
                    )}
                    style={view === "chat" ? { background: BRAND.grad } : undefined}
                  >
                    <Sparkles size={14} className="inline mr-1.5" /> Terminal
                  </button>

                  <button
                    onClick={() => setView("activity")}
                    className={clsx(
                      "px-4 py-2 rounded-[16px] font-black text-xs transition-all",
                      view === "activity" ? "text-white shadow-md" : "text-[var(--u-text-3)] hover:text-white"
                    )}
                    style={view === "activity" ? { background: BRAND.grad } : undefined}
                  >
                    <History size={14} className="inline mr-1.5" /> Logs
                  </button>
                </div>

                {loadingOrgs && (
                  <span className="text-xs font-bold text-[var(--u-teal)] flex items-center gap-2">
                    <RefreshCcw className="animate-spin" size={14} /> Sincronizando…
                  </span>
                )}
              </div>

              {view === "chat" ? (
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => send(a.prompt)}
                      className="px-3 py-1.5 rounded-full unicos-glass-soft text-[11px] font-black text-[var(--u-text-2)] hover:text-white hover:border-[var(--u-teal)] transition-colors"
                      disabled={busy}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 md:w-[240px]">
                    <Search className="absolute left-3 top-2.5 text-[var(--u-text-3)]" size={16} />
                    <input
                      value={auditQ}
                      onChange={(e) => setAuditQ(e.target.value)}
                      placeholder="Filtrar logs…"
                      className="unicos-input pl-10 py-2.5 text-xs"
                    />
                  </div>
                  <button
                    onClick={loadAudit}
                    className="p-2.5 rounded-[16px] unicos-glass-soft text-[var(--u-text-2)] hover:text-white"
                    disabled={auditBusy}
                  >
                    <RefreshCcw size={16} className={auditBusy ? "animate-spin" : ""} />
                  </button>
                </div>
              )}
            </div>

            {/* CONTENT AREA */}
            {view === "chat" ? (
              <>
                <div className="p-5 flex-1 overflow-y-auto space-y-4 unicos-grid-lines">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        "max-w-[88%] rounded-[22px] px-5 py-3.5 text-[14px] leading-relaxed font-medium shadow-sm",
                        m.role === "assistant"
                          ? "unicos-glass-soft text-[var(--u-text)] rounded-tl-sm border border-[var(--u-border)] backdrop-blur-md"
                          : "text-white ml-auto rounded-tr-sm"
                      )}
                      style={m.role === "user" ? { background: BRAND.grad, border: "1px solid rgba(255,255,255,0.15)" } : undefined}
                    >
                      {m.content}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <div className="p-4 border-t border-[var(--u-border)] bg-[var(--u-panel-strong)] flex gap-3 relative z-10">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                    className="flex-1 unicos-input"
                    placeholder="Comando para la IA…"
                    disabled={busy}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={busy || !input.trim()}
                    className="px-6 py-3 rounded-[18px] text-white font-black flex items-center gap-2 disabled:opacity-50 unicos-btn"
                    style={{ background: BRAND.grad, boxShadow: "0 8px 24px rgba(14, 165, 233, 0.25)" }}
                  >
                    {busy ? <RefreshCcw size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5 flex-1 overflow-y-auto unicos-grid-lines">
                {auditBusy ? (
                  <div className="p-6 rounded-2xl unicos-glass-soft text-[var(--u-text-2)] font-bold text-center text-sm">
                    Extrayendo registros del servidor...
                  </div>
                ) : filteredAudit.length ? (
                  <div className="space-y-3">
                    {filteredAudit.slice(0, 120).map((r) => (
                      <div key={r.id} className="p-4 rounded-[20px] unicos-glass-soft hover:bg-[var(--u-panel-soft)] transition-colors">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-black text-[var(--u-text)] text-sm">{r.action}</p>
                            <p className="text-[11px] font-semibold text-[var(--u-text-3)] mt-1">
                              {r.actor_email || "Sistema"} •{" "}
                              {r.created_at ? new Date(r.created_at).toLocaleString("es-MX") : "—"}
                            </p>
                          </div>
                          {r.entity ? (
                            <span className="unicos-chip">
                              {r.entity}
                            </span>
                          ) : null}
                        </div>
                        {r.summary ? (
                          <p className="mt-3 text-sm font-medium text-[var(--u-text-2)] leading-relaxed">{r.summary}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl unicos-glass-soft text-[var(--u-text-3)] font-bold text-center text-sm">
                    Sin registros o faltan permisos de administrador.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
