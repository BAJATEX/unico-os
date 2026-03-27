/* UnicOs — Service Worker (Migración Vercel)
   Objetivo:
   - Cachear solo assets estáticos (Next chunks / imágenes / iconos)
   - NO interceptar navegación (Lighthouse/DevTools estable)
*/
const VERSION = "unicos-sw-vercel-v1"; // Forzamos actualización de caché en la migración
const STATIC_CACHE = `unicos-static-${VERSION}`;
const RUNTIME_CACHE = `unicos-runtime-${VERSION}`;

const PRECACHE = ["/offline.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

async function safePrecache() {
  const cache = await caches.open(STATIC_CACHE);
  for (const path of PRECACHE) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (res && res.ok) await cache.put(path, res.clone());
    } catch {}
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(safePrecache());
  // NO skipWaiting automático: evita saltos raros en auditorías
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) =>
          k.startsWith("unicos-") && k !== STATIC_CACHE && k !== RUNTIME_CACHE ? caches.delete(k) : null
        )
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: true });

  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // 🔥 Navegación: NO interceptar (evita error Lighthouse Network.getResponseBody)
  if (req.mode === "navigate") return;

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return;

  // Next chunks (hashed) => cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }
});
