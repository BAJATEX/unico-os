// src/app/sw-register.js
"use client";

import { useEffect } from "react";

/**
 * SW Register (Lighthouse-safe)
 * - Registra el SW después de load/idle para evitar bugs de DevTools/Lighthouse con MainDocumentContent
 */
export default function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // silence
      }
    };

    const onLoad = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => register(), { timeout: 2500 });
      } else {
        setTimeout(() => register(), 1200);
      }
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}