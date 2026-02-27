// src/app/sw-register.js
"use client";

import { useEffect } from "react";

/**
 * SwRegister (UnicOs)
 * Objetivo: 0 errores en consola + 0 loops + Lighthouse estable.
 *
 * Claves:
 * - Registramos el SW cuando la página ya está estable (load/idle) para no afectar métricas.
 * - Si hay update, hacemos 1 solo reload por pestaña (sessionStorage flag).
 * - Silencioso: NO hacemos console.warn/error (Best Practices).
 */

const SW_URL = "/sw.js";
const RELOAD_KEY = "__unicos_sw_reloaded__";

function schedule(fn) {
  const run = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => fn(), { timeout: 1500 });
    } else {
      setTimeout(fn, 250);
    }
  };

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
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
        if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {}

      window.location.reload();
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

        // Si hay update esperando, lo activamos inmediatamente (sin ruido).
        if (reg.waiting) {
          try {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } catch {}
        }

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
        // Silencioso
      }
    };

    schedule(register);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}