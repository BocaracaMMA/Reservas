// ./service-worker.js (GitHub Pages friendly, relativo al repo)
const SW_VERSION = "v7";
const APP_CACHE  = `app-${SW_VERSION}`;
const PRECACHE   = [
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
  "./assets/favicon-32x32.png",
  "./manifest.webmanifest",
  "./js/pwa-install.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k.startsWith("app-") && k !== APP_CACHE ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Aca HTML -> network-first con fallback cache y luego offline
// Y Estático -> cache-first con actualización en segundo plano
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("./offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndUpdate = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchAndUpdate;
    })
  );
});
