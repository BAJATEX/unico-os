/* ÚNICO OS — Service Worker (Admin Secure Mode) */
const CACHE_NAME = "unicos-admin-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // SEGURIDAD: Jamás cachear Supabase, APIs o las imágenes del Storage
  if (
    url.pathname.startsWith("/api/") ||
    url.origin.includes("supabase.co") ||
    event.request.method !== "GET"
  ) {
    return; // Bypass network directamente
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});