/* ÚNICO OS — Service Worker (Admin SAFE v2)
   FIX REAL:
   - NO cachea "/" (Next.js + chunks = riesgo de pantallas en blanco)
   - Solo cachea íconos/manifest (PWA) y deja Next manejar el resto
   - Bypass total de /_next, /api y Supabase
*/

const CACHE_NAME = "unicos-admin-static-v2";

// Solo assets PWA (no páginas)
const PRECACHE = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE.map(async (p) => {
          try {
            const res = await fetch(new Request(p, { cache: "reload" }));
            if (res && (res.ok || res.type === "opaque")) await cache.put(p, res.clone());
          } catch (_) {}
        })
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // No tocar navegación (evita HTML viejo)
  if (req.mode === "navigate") return;

  // Bypass absoluto de Next + APIs + Supabase
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin.includes("supabase.co")) return;

  // Solo responder desde cache para assets PWA precacheados
  if (!PRECACHE.includes(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;

      const fresh = await fetch(req);
      if (fresh && (fresh.ok || fresh.type === "opaque")) {
        await cache.put(req, fresh.clone());
      }
      return fresh;
    })()
  );
});