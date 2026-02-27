// src/app/sw-register.js
"use client";

import { useEffect } from "react";

/**
 * SwRegister (UnicOs)
 *
 * Objetivo: mantener Lighthouse alto y evitar errores en consola.
 * - Si /sw.js responde HTML (por redirect / 404), NO intentamos registrar.
 * - Evita loops de recarga con un flag en sessionStorage.
 */

const SW_URL = "/sw.js";

const isLikelyJs = (contentType) => {
  const ct = String(contentType || "").toLowerCase();
  return ct.includes("javascript") || ct.includes("ecmascript") || ct.includes("text/plain");
};

async function canRegisterServiceWorker() {
  try {
    if (!window.isSecureContext) return false;

    const res = await fetch(SW_URL, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });

    if (!res.ok) return false;

    const ct = res.headers.get("content-type") || "";
    if (ct.toLowerCase().includes("text/html")) return false;

    return isLikelyJs(ct);
  } catch {
    return false;
  }
}

export default function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;

      try {
        if (sessionStorage.getItem("__unicos_sw_reload__") === "1") return;
        sessionStorage.setItem("__unicos_sw_reload__", "1");
      } catch {}

      window.location.reload();
    };

    const register = async () => {
      try {
        const ok = await canRegisterServiceWorker();
        if (!ok) return;

        const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          if (!w) return;

          w.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) {
              try {
                w.postMessage({ type: "SKIP_WAITING" });
              } catch {}
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      } catch {
        // Silencioso: la idea es NO ensuciar consola (Lighthouse)
      }
    };

    register();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}