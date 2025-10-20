// ./service-worker.js
const APP_VERSION = '2025.10.20.v1';              // Subir en cada release
const CACHE_NAME  = `app-${APP_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll([...files])))
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // esto borra TODO lo viejo
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // Notifica de versión activa
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type:'ACTIVE_VERSION', version: APP_VERSION }));
  })());
});


self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // no caches para documentos HTML (siempre red desde network)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // para JS/CSS propios: network-first
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

  // resto: cache-first
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
    self.skipWaiting();
  }
  if (msg.type === 'CLEAR_ALL_CACHES') {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const regs = await self.registration.getNotifications();
    // esta vara después de limpiar, fuerza navegar/recargar todas las ventanas
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  }
});
