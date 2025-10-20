// ./js/sw-register.js
const APP_VERSION = '2025.10.20.v1'; // Subir esto con cada release

(async () => {
  if (!('serviceWorker' in navigator)) return;

  // Asegura ?v= en el manifest también (Safari/iOS agradece)
  const link = document.querySelector('link[rel="manifest"]');
  if (link && !link.href.includes('v=')) {
    const u = new URL(link.href, location.href);
    u.searchParams.set('v', APP_VERSION);
    link.href = u.toString();
  }

  try {
    const reg = await navigator.serviceWorker.register(
      `./service-worker.js?v=${APP_VERSION}`,
      { updateViaCache: 'none' } // evita SW cacheado en Safari
    );

    // Buscar updates periódicamente
    setInterval(() => reg.update(), 30 * 60 * 1000);

    // Si hay nueva versión esperando, activarla
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // Cuando entra el SW nuevo, recargar
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      location.reload();
    });
  } catch (err) {
    console.error('SW register failed', err);
  }
})();

// Botón “hard reset” (punto 4)
window.forceHardReset = async function() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
    }
    await reg?.update();
  } catch (e) {
    console.error('forceHardReset error', e);
  }
};
