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



// ─── REGISTRO DEL SERVICE WORKER (silencioso y con recarga controlada) ────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Importante en GH Pages: versión en query + scope relativo
      const reg = await navigator.serviceWorker.register('./service-worker.js?v=2025.10.20.v3', { scope: './' });

      // Recarga solo UNA vez cuando cambia el controlador
      let didReload = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (didReload) return;
        didReload = true;
        window.location.reload();
      });

      // Si ya hay un SW nuevo en "waiting", actualiza de una
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Cuando llega un SW nuevo a "installed", actualiza
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // (Opcional) chequeo al estar listo
      navigator.serviceWorker.ready.then(r => r.update().catch(() => {}));
      // Si ves algo raro, puedes comentar el setInterval siguiente.
      // setInterval(async () => (await navigator.serviceWorker.getRegistration())?.update(), 30 * 60 * 1000);
    } catch (e) {
        console.error('SW register error', e);
    }
  });
}
