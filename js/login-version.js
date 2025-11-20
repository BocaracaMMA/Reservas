// ./js/login-version.js
// Muestra en el login la versión de la app leída desde el Service Worker.

async function getServiceWorkerVersion() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Esperamos a que el SW esté listo (instalado + activo)
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.active) return null;

    return await new Promise((resolve) => {
      const channel = new MessageChannel();

      const timeout = setTimeout(() => {
        // Si en ~2s no responde, devolvemos null
        resolve(null);
      }, 2000);

      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        const data = event.data || {};
        resolve(data.version || data.APP_VERSION || null);
      };

      reg.active.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  } catch (err) {
    console.error('[login-version] Error obteniendo versión del SW:', err);
    return null;
  }
}

async function updateLoginVersionLabel() {
  const label = document.getElementById('appVersionLabel');
  if (!label) return;

  // Texto inicial mientras cargamos
  label.textContent = 'Versión cargando…';

  const version = await getServiceWorkerVersion();

  if (version) {
    label.textContent = `Versión ${version}`;
  } else {
    // Fallback si algo falla (sin romper el login)
    label.textContent = 'Versión desconocida';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateLoginVersionLabel().catch(() => {});
});
