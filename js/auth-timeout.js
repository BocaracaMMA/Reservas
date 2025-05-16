import {
  getAuth,
  signOut,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { app } from './firebase-config.js';

const auth = getAuth(app);

// Mantiene la sesión solo mientras el navegador esté abierto
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

function showToast(message, type = 'success') {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Eliminar el toast después de la animación
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function setupInactivityTimeout(minutes = 3) {
  let inactivityTimer;
  let warningTimer;

  const warningTime = 110 * 1000; // 1 min 50 seg en ms
  const logoutTime = minutes * 60 * 1000; // 3 min en ms

  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);

    warningTimer = setTimeout(() => {
      showToast("Tu sesión se cerrará pronto por inactividad.", "error");

      // El toast dura 2 segundos, pero showToast ya lo elimina en 4s,
      // si quieres 2s exacto podríamos ajustar showToast o eliminar manualmente
    }, warningTime);

    inactivityTimer = setTimeout(() => {
      signOut(auth).then(() => {
        showToast("Sesión cerrada por inactividad", "success");
        window.location.href = "./index.html";
      });
    }, logoutTime);
  };

  ["mousemove", "keydown", "scroll", "click"].forEach(event =>
    window.addEventListener(event, resetTimer)
  );

  resetTimer();
}


export { setupInactivityTimeout };
