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



// ─── REGISTRO SW (modo 100% manual, sin auto-update ni auto-reload) ───────────
(function(){
  if (!('serviceWorker' in navigator)) return;

  // Debe coincidir con APP_VERSION del SW
  const SW_URL = './service-worker.js?v=2025.10.20.v6';
  let reg = null;

  async function ensureReg() {
    if (reg) return reg;
    reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      try { reg = await navigator.serviceWorker.register(SW_URL, { scope: './' }); }
      catch { /* no-op */ }
    }
    return reg;
  }

  // No hacemos updates automáticos ni recargas aquí
  ensureReg();

  // Exponemos API manual para tus botones de admin
  window.swUpdate = {
    // Descarga un SW nuevo si lo hay y te dice si quedó en 'waiting'
    async check() {
      const r = await ensureReg();
      try { await r?.update(); } catch {}
      return !!r?.waiting;
    },
    // Aplica el SW esperando y recarga SOLO UNA VEZ
    async apply() {
      const r = await ensureReg();
      if (r?.waiting) {
        const once = () => location.reload();
        navigator.serviceWorker.addEventListener('controllerchange', once, { once:true });
        r.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    },
    // Reset nuclear (opcional)
    async reset() {
      const r = await ensureReg();
      r?.active?.postMessage({ type: 'CLEAR_ALL_CACHES' });
    },
    // Estado útil para debug
    async status() {
      const r = await ensureReg();
      return { scope: r?.scope, active: !!r?.active, waiting: !!r?.waiting };
    }
  };
})();

// Forzar actualización manual reutilizable en todas las páginas
window.forceHardReset = async () => {
  try {
    // 1) Buscar si hay un SW nuevo esperando
    const waiting = await window.swUpdate?.check();
    if (waiting) {
      // Hay versión nueva -> aplicarla y recargar UNA sola vez
      window.showAlert?.('Actualizando a la última versión…', 'success');
      await window.swUpdate.apply();
      return; // la recarga ocurre tras controllerchange
    }

    // 2) Si no hay versión nueva, hacemos "hard reset" de cachés y recargamos
    window.showAlert?.('No hay versión nueva. Limpiando caché…', 'success');
    await window.swUpdate?.reset();
  } catch (err) {
    console.error('forceHardReset()', err);
    alert('No pude completar la actualización. Intenta recargar la página.');
  }
};
