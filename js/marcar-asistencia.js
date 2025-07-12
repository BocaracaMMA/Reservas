// ./js/marcar-asistencia.js

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupInactivityTimeout }      from './auth-timeout.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', () => {
    const ADMIN_UIDS = [
        "TWAkND9zF0UKdMzswAPkgas9zfL2", // ivan
        "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"  // luis
    ];

    onAuthStateChanged(auth, (user) => {
        if (!user || !ADMIN_UIDS.includes(user.uid)) {
            window.location.href = './index.html';
            return;
        }

        iniciarPanelAdmin();
    });

    const toggleButton = document.getElementById("toggleNav");
    const sidebar = document.getElementById("sidebar");

    toggleButton.addEventListener("click", () => {
        sidebar.classList.toggle("active");
    });

    // Si usas Lucide icons
    lucide.createIcons();

});

// Toggle sidebar
document.getElementById('toggleNav').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

document.addEventListener("DOMContentLoaded", () => {
  // 1) Auto‑logout por inactividad
  setupInactivityTimeout();

  // 2) Inicializar Lucide Icons (si las usas)
  if (window.lucide) lucide.createIcons();

  // 3) BIND LOCAL para toggleNav (por si el global falló)
  const btn = document.getElementById("toggleNav");
  const sb  = document.getElementById("sidebar");
  if (btn && sb) {
    btn.addEventListener("click", () => sb.classList.toggle("active"));
  }

  // 4) Seguridad: sólo profesores
  onAuthStateChanged(auth, user => {
    if (!user || !PROFESSOR_UIDS.includes(user.uid)) {
      window.location.href = './index.html';
    }
  });

  // 5) Cerrar sesión
  document.getElementById("logoutSidebar")
    .addEventListener("click", async e => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert("Has cerrado sesión", "success");
        setTimeout(() => window.location.href = "index.html", 1000);
      } catch {
        showAlert("Error al cerrar sesión", "error");
      }
    });

  // 6) Marcar por código
  document.getElementById("attendanceForm")
    .addEventListener("submit", async e => {
      e.preventDefault();
      const code = document.getElementById("codeInput").value.trim();
      if (code.length !== 4) {
        showAlert("Ingresa un código válido de 4 dígitos", "error");
        return;
      }
      try {
        const usersQ = query(collection(db, "users"), where("attendanceCode", "==", code));
        const snap = await getDocs(usersQ);
        if (snap.empty) {
          showAlert("Código no encontrado", "error");
          return;
        }
        const uid     = snap.docs[0].id;
        const fechaCR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
        const ref     = doc(db, "asistencias", fechaCR, "usuarios", uid);
        await updateDoc(ref, { presente: true });
        showAlert(`Asistencia marcada: ${snap.docs[0].data().nombre}`, "success");
        e.target.reset();
      } catch (err) {
        console.error(err);
        showAlert("Error al marcar asistencia", "error");
      }
    });

  // 7) Generar QR
  const qrCanvas = document.getElementById("qrcode");
  document.getElementById("btnGenQR")
    .addEventListener("click", () => {
      const fechaCR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
      const payload = JSON.stringify({ fecha: fechaCR });
      // usa el global QRCode
      QRCode.toCanvas(qrCanvas, payload, { width: 250 }, err => {
        if (err) {
          console.error("QR error:", err);
          showAlert("No se pudo generar el QR", "error");
        } else {
          showAlert("QR generado", "success");
        }
      });
    });
});
