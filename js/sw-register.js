// ./js/sw-register.js
(function(){
  if (!('serviceWorker' in navigator)) return;

  const swUrl = './service-worker.js?v=2025.10.20.v7';

  // Pequeño guard para no recargar más de 1 vez en 2 segundos
  const RELOAD_GUARD_KEY = 'sw-reload-guard';
  function reloadOnce(){
    const now = Date.now();
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (now - last < 2000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
    location.reload();
  }

  navigator.serviceWorker.register(swUrl).then(reg => {
    // Sin controllerchange → reload automáticas
    navigator.serviceWorker.addEventListener('message', (evt) => {
      const msg = evt.data || {};
      if (msg.type === 'CACHES_CLEARED') reloadOnce();
    });

    // API global para el botón
    window.swUpdate = {
      async check() {
        try { await reg.update(); } catch {}
        if (reg.waiting) return reg.waiting;

        // Espera corto por un "waiting" nuevo
        return new Promise(resolve => {
          const onInstalling = () => {
            if (!reg.installing) return resolve(null);
            reg.installing.addEventListener('statechange', () => {
              if (reg.waiting) resolve(reg.waiting);
            });
          };
          reg.addEventListener('updatefound', onInstalling, { once: true });
          setTimeout(() => resolve(null), 2500);
        });
      },
      async apply() {
        const w = reg.waiting || await this.check();
        if (w) w.postMessage({ type: 'SKIP_WAITING' });
      },
      async reset() {
        const sw = navigator.serviceWorker.controller || reg.active || reg.waiting || reg.installing;
        sw?.postMessage?.({ type: 'CLEAR_ALL_CACHES' });
      }
    };

    // Botón global reutilizable
    window.forceHardReset = async () => {
      try {
        const waiting = await window.swUpdate.check();
        if (waiting) {
          window.showAlert?.('Actualizando a la última versión…', 'success');
          await window.swUpdate.apply(); // recarga una sola vez cuando cambie el controlador
          return;
        }
        window.showAlert?.('Limpiando caché…', 'success');
        await window.swUpdate.reset(); // recarga cuando reciba CACHES_CLEARED
      } catch (err) {
        console.error('forceHardReset()', err);
        alert('No pude completar la actualización. Intenta recargar la página.');
      }
    };
  }).catch(console.error);
})();
