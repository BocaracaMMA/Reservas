// ./service-worker.js
const APP_VERSION = '2025.11.02.v1';
const CACHE_NAME  = `app-${APP_VERSION}`;

// Scope real (en GH Pages: /Reservas/)
const ROOT = new URL(self.registration.scope).pathname.replace(/\/?$/, '/');
const p = (path) => (path.startsWith('/') ? path : ROOT + path);

// Precarga mínima (NO interceptamos HTML)
const PRECACHE_URLS = [
  p('offline.html'),
  p('css/style.css'),
  p('js/script.js'),
  p('js/pwa-install.js'),
  p('assets/PWA_icon_192.png'),
  p('assets/PWA_icon_512.png'),
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // Nada de navegar/reload aquí.
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // ignora terceros (CDN/Firebase)

  // SOLO cacheamos estáticos (js/css/img). NO tocamos HTML/navegaciones.
  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|ico|gif)$/.test(url.pathname)) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-store' });
        const c = await caches.open(CACHE_NAME);
        c.put(e.request, fresh.clone());
        return fresh;
      } catch {
        return caches.match(e.request);
      }
    })());
  }
});

// Mensajes desde la página (todo manual)
self.addEventListener('message', async (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') {
    await self.skipWaiting();
  }
  if (type === 'CLEAR_ALL_CACHES') {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const clients = await self.clients.matchAll({ type: 'window' });
    // Avisamos; la página decidirá si recarga.
    clients.forEach(c => c.postMessage({ type: 'CACHES_CLEARED' }));
  }
});
