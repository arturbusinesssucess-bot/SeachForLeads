const CACHE_NAME = "sfl-pwa-v9";
const APP_SHELL = [
  "/app/",
  "/app/app.css?v=sidebar-inset",
  "/app/app.js?v=mobile-sync-20261126",
  "/public/app-sidebar.v1.js?v=mobile-glass",
  "/public/app-mobile.v1.css?v=mobile-sync-20261126",
  "/styles.css",
  "/firebase-config.js",
  "/manifest.webmanifest",
  "/public/loupe-logo.svg",
  "/public/pwa-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("sfl-pwa-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isAppRequest = url.origin === self.location.origin;
  const isManifest = isAppRequest && url.pathname === "/manifest.webmanifest";
  const isFirebaseModule = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");

  if (request.mode === "navigate" && isAppRequest) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-cache" });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(request) || await cache.match("/app/") || Response.error();
      }
    })());
    return;
  }

  if (!isAppRequest && !isFirebaseModule) return;
  if (isAppRequest && !["script", "style", "image", "font"].includes(request.destination) && !isManifest) return;

  // Mutable app modules must refresh together with HTML and CSS on every device.
  // Versioned Firebase CDN modules and static images can remain cache-first.
  if (isManifest || (isAppRequest && ["script", "style"].includes(request.destination))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-cache" });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
