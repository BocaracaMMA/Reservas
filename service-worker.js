// ./service-worker.js — GitHub Pages friendly + safe schemes
const SW_VERSION = "v8"; // ⬅️ Bump de versión
const APP_CACHE  = `app-${SW_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./client-dashboard.html",
  "./admin-dashboard.html",
  "./profile.html",
  "./events.html",
  "./offline.html",
  "./css/style.css",
  "./assets/android-chrome-192x192.png",
  "./assets/android-chrome-512x512.png",
  "./assets/logo.png",
  "./assets/PWA_icon_512.png",
  "./assets/favicon-32x32.png",
  "./manifest.webmanifest",
  "./js/pwa-install.js"
];

// ───────── Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ───────── Activate (limpia caches viejas)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => (k.startsWith("app-") && k !== APP_CACHE ? caches.delete(k) : null))
      )
    ).then(() => self.clients.claim())
  );
});

// Permite forzar activación desde la página
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ───────── Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET
  if (req.method !== "GET") return;

  // Ignorar esquemas no web (chrome-extension, moz-extension, etc.)
  const url = new URL(req.url);
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  if (!isHttp) return;

  // Detectar navegaciones/HTML
  const isNavigate = req.mode === "navigate";
  const accept = req.headers.get("accept") || "";
  const isHTML = isNavigate || accept.includes("text/html");

  // HTML: network-first con fallback a cache y luego offline.html
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cachea copia si OK
          const clone = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match("./offline.html"));
        })
    );
    return;
  }

  // Estático/otros GET: cache-first con actualización silenciosa
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndUpdate = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchAndUpdate;
    })
  );
});

