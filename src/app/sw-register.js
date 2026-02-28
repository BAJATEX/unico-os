// src/app/sw-register.js
"use client";

import { useEffect } from "react";

/**
 * SW Register (safe):
 * - registra PWA
 * - NO fuerza reload (evita Best Practices = 0 por navegación durante auditoría)
 */
export default function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // silence
      }
    })();
  }, []);

  return null;
}