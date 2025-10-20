// ./service-worker.js
const APP_VERSION = '2025.10.20.v2'; // súbelo en cada release
const CACHE_NAME  = `app-${APP_VERSION}`;

// Detecta el scope real (en GH Pages será /Reservas/)
const ROOT_URL = new URL(self.registration.scope);
const ROOT = ROOT_URL.pathname.endsWith('/') ? ROOT_URL.pathname : ROOT_URL.pathname + '/';
const p = (path) => (path.startsWith('/') ? path : ROOT + path);

// Archivos mínimos a precachear (añade los JS/CSS base que uses en las primeras pantallas)
const PRECACHE_URLS = [
  p('index.html'),
  p('offline.html'),
  p('css/style.css'),
  p('js/script.js'),
  p('js/pwa-install.js'),
  p('js/firebase-config.js'),
  p('js/role-guard.js'),
  p('js/showAlert.js'),
  p('assets/PWA_icon_192.png'),
  p('assets/PWA_icon_512.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE_NAME);
    await c.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type:'ACTIVE_VERSION', version: APP_VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo manejamos mismas-orígenes; deja terceros (CDN) al navegador
  if (url.origin !== location.origin) return;

  // Navegación/HTML -> network-first con fallback a offline.html o index.html
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith((async () => {
      try {
        return await fetch(req, { cache: 'no-store' });
      } catch {
        return (await caches.match(p('offline.html'))) || (await caches.match(p('index.html')));
      }
    })());
    return;
  }

  // JS/CSS -> network-first (para evitar quedarse con versiones viejas)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(CACHE_NAME);
        c.put(req, fresh.clone());
        return fresh;
      } catch {
        return caches.match(req);
      }
    })());
    return;
  }

  // Resto -> cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const c = await caches.open(CACHE_NAME);
      c.put(req, res.clone());
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});

// Mensajes desde la página
self.addEventListener('message', async (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') {
    await self.skipWaiting();
  }
  if (msg.type === 'CLEAR_ALL_CACHES') {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  }
});
