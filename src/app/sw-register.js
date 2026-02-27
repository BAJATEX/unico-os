"use client";

import { useEffect } from "react";

/**
 * UnicOs — Service Worker Register (PRO)
 * - Lighthouse-safe: NO forced reload on controllerchange.
 * - Update-ready: asks SW to SKIP_WAITING so the new SW activates ASAP.
 * - Update applies on next navigation/refresh (no sudden interruption).
 */

const SW_URL = "/sw.js";

function runWhenIdle(fn) {
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

    let isMounted = true;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
        if (!isMounted) return;

        // If an update is already waiting, activate it (no reload).
        if (reg.waiting) {
          try {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } catch {}
        }

        // Listen for new updates.
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;

          sw.addEventListener("statechange", () => {
            // When installed AND there is an existing controller, it means it's an update.
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              try {
                sw.postMessage({ type: "SKIP_WAITING" });
              } catch {}
              // No auto-reload here (Lighthouse-safe + UX-safe).
            }
          });
        });

        // Controller change means new SW is controlling the page.
        // We intentionally DO NOT reload here.
        // Users will naturally get the updated shell on next visit/refresh.
      } catch {
        // silent
      }
    };

    runWhenIdle(register);

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}