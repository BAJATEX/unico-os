"use client";

import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // Si hay una actualización esperando, avisamos al Service Worker
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Nueva versión lista
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        // Verificación de actualización cada hora (ideal para apps PWA en móvil)
        setInterval(() => {
          reg.update();
        }, 3600000);

      } catch (err) {
        console.error("SW registration failed:", err);
      }
    };

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      // Solo recargamos si el usuario no está en medio de una acción crítica
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
