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

function setupInactivityTimeout(minutes = 1 ) {
  let inactivityTimer;

  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      signOut(auth).then(() => {
        showToast("Sesión cerrada por inactividad");
        window.location.href = "./index.html";
      });
    }, minutes * 60 * 1000);
  };

  ["mousemove", "keydown", "scroll", "click"].forEach((event) =>
    window.addEventListener(event, resetTimer)
  );

  resetTimer();
}

export { setupInactivityTimeout };
