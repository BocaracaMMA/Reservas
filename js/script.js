// ─── ./js/script.js ────────────────────────────────────────────────────────────

// Mostrar alertas tipo toast
function showAlert(message, type = 'success') {
  let container = document.getElementById('toast-container');

  // Si no existe el contenedor, lo creamos
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Eliminar el toast después de 4 segundos (coincide con tu animación fadeInOut)
  setTimeout(() => {
    toast.remove();
  }, 4000);
}



// ─── LOGIN ────────────────────────────────────────────────────────────────────
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // Simulación de login
    if (email === "admin@mma.com" && password === "admin123") {
      showAlert('Login exitoso como administrador!', 'success');
      setTimeout(() => {
        window.location.href = './admin-dashboard.html';
      }, 1000);
    } else if (email && password) {
      showAlert('Login exitoso como cliente!', 'success');
      setTimeout(() => {
        window.location.href = './client-dashboard.html';
      }, 1000);
    } else {
      showAlert('Email o contraseña incorrectos.', 'error');
    }
  });
}



// ─── REGISTRO ─────────────────────────────────────────────────────────────────
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const cedula = document.getElementById("cedula").value.trim();

    // Simulación de registro exitoso
    if (email && password && fullName && phone && cedula) {
      showAlert('Registro exitoso!', 'success');
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);
    } else {
      showAlert('Por favor completa todos los campos.', 'error');
    }
  });
}



// ─── RESERVAR CLASE ────────────────────────────────────────────────────────────
const reserveButton = document.getElementById("reserve-button");
if (reserveButton) {
  reserveButton.addEventListener("click", async () => {
    const selectedDate = "2025-05-03"; // Fecha de ejemplo
    // Simular reserva exitosa
    showAlert(`Clase reservada para el ${selectedDate}`, 'success');
  });
}



// ─── LOGOUT EN PÁGINA DE CLIENTE ───────────────────────────────────────────────
const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    showAlert('Sesión cerrada.', 'success');
    setTimeout(() => {
      window.location.href = './index.html';
    }, 1000);
  });
}



// ─── TOGGLE DEL SIDEBAR EN REPORTES.HTML ───────────────────────────────────────
const toggleNavBtn = document.getElementById('toggleNav');
if (toggleNavBtn) {
  toggleNavBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  });
}



// ─── CERRAR SESIÓN DESDE EL SIDEBAR EN REPORTES.HTML ───────────────────────────
const logoutSidebarLink = document.getElementById('logoutSidebar');
if (logoutSidebarLink) {
  logoutSidebarLink.addEventListener('click', async (e) => {
    e.preventDefault();
    showAlert('Sesión cerrada.', 'success');
    setTimeout(() => {
      window.location.href = './index.html';
    }, 1000);
  });
}



// ─── REGISTRO DEL SERVICE WORKER (con cleanup y recarga 1 sola vez) ──────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // 0) Limpieza de registros con scope equivocado (p.ej. uno en "/")
      const expectedScope = new URL('./', location.href).pathname; // en GH Pages será "/Reservas/"
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach(r => {
        const scopePath = new URL(r.scope).pathname;
        if (scopePath !== expectedScope) {
          // Unregister SW fuera de nuestro scope real para evitar “pelea de controladores”
          r.unregister().catch(() => {});
        }
      });

      // 1) Registrar con versión fija (NO cambies el query hasta el próximo release)
      const reg = await navigator.serviceWorker.register('./service-worker.js?v=2025.10.20.v4', { scope: './' });

      // 2) Recarga 1 sola vez si cambia el controlador
      let didReload = sessionStorage.getItem('sw-reloaded') === '1';
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (didReload) return;
        didReload = true;
        sessionStorage.setItem('sw-reloaded', '1');
        // pequeña espera evita loops en iOS al cambiar controlador
        setTimeout(() => location.reload(), 120);
      });

      // Limpia la marca al navegar/abrir de nuevo
      window.addEventListener('pageshow', () => {
        // si la página volvió desde bfcache, mantenla; en navegación nueva se limpia
        if (!performance.getEntriesByType('navigation')[0]?.type.includes('back_forward')) {
          sessionStorage.removeItem('sw-reloaded');
        }
      });

      // 3) Si ya hay un SW nuevo esperando, actívalo una vez y listo
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 4) Evita “recarga en caliente” en cada updatefound (iOS puede duplicarlo).
      //    Dejamos que el SW nuevo quede en waiting y tomará control en la próxima navegación.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          // NO forzamos skipWaiting aquí para evitar loops en algunos móviles.
          // if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          //   sw.postMessage({ type: 'SKIP_WAITING' });
          // }
        });
      });

      // 5) Chequeo pasivo al estar listo (no fuerza recargas en bucle)
      navigator.serviceWorker.ready.then(r => r.update().catch(() => {}));
    } catch (e) {
      // opcional: console.error('SW register error', e);
    }
  });
}
