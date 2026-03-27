"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const SCORESTORE_URL =
  process.env.NEXT_PUBLIC_SCORESTORE_URL || "https://scorestore.vercel.app";

const FALLBACK_SUPPORT_EMAIL = "ventas.unicotextil@gmail.com";
const FALLBACK_SUPPORT_WA = "https://wa.me/5216642368701";

const rowStyle = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "16px",
  padding: "14px",
  background: "rgba(255,255,255,0.75)",
};

function Badge({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(225,6,0,0.08)",
        color: "#e10600",
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

export default function ScoreStoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState(null);
  const [error, setError] = useState("");

  const supportEmail = useMemo(() => {
    const email = site?.contact?.email?.trim();
    return email || FALLBACK_SUPPORT_EMAIL;
  }, [site]);

  const supportWa = useMemo(() => {
    const wa = site?.contact?.whatsapp_e164?.trim();
    return wa ? `https://wa.me/${wa}` : FALLBACK_SUPPORT_WA;
  }, [site]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/site_settings", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        if (!cancelled) setSite(data);
      } catch (e) {
        if (!cancelled) setError(String(e?.message || "No fue posible cargar la configuración."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(15,15,15,0.96))",
        color: "#fff",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <Badge>Score Store Settings</Badge>
            <h1 style={{ margin: "12px 0 6px", fontSize: "clamp(28px, 4vw, 42px)" }}>
              Centro de sincronización
            </h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
              Configuración pública, branding, enlaces y contacto conectados con Score Store.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href={SCORESTORE_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: 999,
                background: "#e10600",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Abrir Score Store
            </a>

            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              Volver al panel
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={rowStyle}>Cargando configuración...</div>
        ) : error ? (
          <div style={{ ...rowStyle, borderColor: "rgba(225,6,0,0.35)", color: "#fff" }}>
            {error}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <section style={rowStyle}>
              <h2 style={{ marginTop: 0 }}>Contacto</h2>
              <p style={{ margin: "10px 0" }}>
                <strong>Email:</strong> {supportEmail}
              </p>
              <p style={{ margin: "10px 0" }}>
                <strong>WhatsApp:</strong>{" "}
                <a href={supportWa} target="_blank" rel="noreferrer" style={{ color: "#e10600" }}>
                  {site?.contact?.whatsapp_display || "664 236 8701"}
                </a>
              </p>
              <p style={{ margin: "10px 0" }}>
                <strong>Teléfono:</strong> {site?.contact?.phone || "6642368701"}
              </p>
            </section>

            <section style={rowStyle}>
              <h2 style={{ marginTop: 0 }}>Tienda conectada</h2>
              <p style={{ margin: "10px 0" }}>
                <strong>Nombre:</strong> {site?.store?.name || "SCORE STORE"}
              </p>
              <p style={{ margin: "10px 0" }}>
                <strong>Estado:</strong>{" "}
                {site?.maintenance_mode ? "Mantenimiento" : "Operativa"}
              </p>
              <p style={{ margin: "10px 0" }}>
                <strong>Promoción:</strong>{" "}
                {site?.promo_active ? "Activa" : "Inactiva"}
              </p>
            </section>

            <section style={rowStyle}>
              <h2 style={{ marginTop: 0 }}>Notas públicas</h2>
              <p style={{ margin: "10px 0", lineHeight: 1.6 }}>
                {site?.home?.footer_note || "Pago cifrado vía Stripe. Aceptamos OXXO Pay."}
              </p>
              <p style={{ margin: "10px 0", lineHeight: 1.6 }}>
                {site?.home?.shipping_note || "Logística inteligente internacional con Envía.com."}
              </p>
            </section>

            <section style={rowStyle}>
              <h2 style={{ marginTop: 0 }}>Enlaces oficiales</h2>
              <p style={{ margin: "10px 0" }}>
                <a href={SCORESTORE_URL} target="_blank" rel="noreferrer" style={{ color: "#e10600" }}>
                  {SCORESTORE_URL}
                </a>
              </p>
              <p style={{ margin: "10px 0" }}>
                <Link href="/legal" style={{ color: "#e10600" }}>
                  Ver legales
                </Link>
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}