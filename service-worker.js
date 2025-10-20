// ./service-worker.js
const APP_VERSION = '2025.10.20.v3';          // súbelo en cada release
const CACHE_NAME  = `app-${APP_VERSION}`;

// Detecta el scope real (en GH Pages será /Reservas/)
const ROOT_URL = new URL(self.registration.scope);
const ROOT = ROOT_URL.pathname.endsWith('/') ? ROOT_URL.pathname : ROOT_URL.pathname + '/';
const p = (path) => (path.startsWith('/') ? path : ROOT + path);

// Archivos mínimos a precachear (asegúrate de que EXISTEN)
const PRECACHE_URLS = [
  p('index.html'),
  p('offline.html'),
  p('css/style.css'),
  p('js/script.js'),
  p('js/pwa-install.js'),
  p('js/firebase-config.js'),
  p('js/role-guard.js'),
  p('js/showAlert.js'),
  p('assets/PWA_icon_512.png'),
  p('assets/PWA_icon_192.png'),
];

// Precarga tolerante a errores (si algo falta, no rompe la instalación)
async function safePrecache(urls) {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) await cache.put(url, res.clone());
      } catch (e) {
        // opcional: console.warn('SW precache skip:', url, e);
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await safePrecache(PRECACHE_URLS);
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
  const accept = req.headers.get('accept') || '';

  // Solo mismas-orígenes; deja terceros (CDN) al navegador
  if (url.origin !== location.origin) return;

  // Navegación/HTML -> network-first con fallback a offline.html
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith((async () => {
      try {
        return await fetch(req, { cache: 'no-store' });
      } catch {
        return (await caches.match(p('offline.html'))) || (await caches.match(p('index.html')));
      }
    })());
    return;
  }

  // JS/CSS -> network-first (para no quedarnos con versiones viejas)
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
