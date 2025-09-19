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
// Si existe el botón hamburguesa con id="toggleNav"
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
// Si existe el enlace con id="logoutSidebar", cerramos sesión redirigiendo
const logoutSidebarLink = document.getElementById('logoutSidebar');
if (logoutSidebarLink) {
  logoutSidebarLink.addEventListener('click', async (e) => {
    e.preventDefault();
    // Aquí podrás integrar signOut(auth) si estás usando Firebase Auth,
    // pero en tu script original solo rediriges a index.html:
    showAlert('Sesión cerrada.', 'success');
    setTimeout(() => {
      window.location.href = './index.html';
    }, 1000);
  });
}

// ─── Notificacion de nuevo parche ────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('./service-worker.js');

    function promptUpdate(sw) {
      // Muestra un toast y, al aceptar, manda SKIP_WAITING
      // Si tu showAlert no soporta botones, puedes crear un botón flotante.
      if (confirm('Nueva versión disponible. Toca aceptar para actualizar.')) {
        sw.postMessage({ type: 'SKIP_WAITING' });
      }
    }

    // SW nuevo quedó en "waiting"
    if (reg.waiting) promptUpdate(reg.waiting);

    // Cuando llegue un SW nuevo a "installed"
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          promptUpdate(newSW);
        }
      });
    });

    // Cuando el SW cambia (después de SKIP_WAITING) recargamos
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });

  // opcional: escuchar mensajes desde el SW
  navigator.serviceWorker.addEventListener('message', (e) => {
    // manejar mensajes si los envías desde el SW
  });
}