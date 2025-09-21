// ./js/marcar-asistencia.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, query, where, getDocs,
  doc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

const ADMIN_UIDS = [
  "vVUIH4IYqOOJdQJknGCjYjmKwUI3", // ivan
  "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"  // luis
];

document.addEventListener('DOMContentLoaded', () => {
  // Toggle sidebar
  const toggleButton = document.getElementById("toggleNav");
  const sidebar      = document.getElementById("sidebar");
  if (toggleButton && sidebar) {
    toggleButton.addEventListener("click", () => sidebar.classList.toggle("active"));
  }

  // Lucide (si está)
  if (window.lucide) window.lucide.createIcons();

  // Seguridad: sólo admins/profes
  onAuthStateChanged(auth, (user) => {
    if (!user || !ADMIN_UIDS.includes(user.uid)) {
      window.location.href = './index.html';
      return;
    }
  });

  // Cerrar sesión
  const logoutSidebar = document.getElementById("logoutSidebar");
  if (logoutSidebar) {
    logoutSidebar.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert("Has cerrado sesión", "success");
        setTimeout(() => (window.location.href = "index.html"), 800);
      } catch {
        showAlert("Error al cerrar sesión", "error");
      }
    });
  }

  // ── 1) Marcar por código
  const form = document.getElementById("attendanceForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (document.getElementById("codeInput").value || '').trim();
    if (!/^\d{4}$/.test(code)) {
      showAlert("Ingresa un código válido de 4 dígitos", "error");
      return;
    }
    try {
      const usersQ = query(collection(db, "users"), where("attendanceCode", "==", code));
      const snap   = await getDocs(usersQ);
      if (snap.empty) {
        showAlert("Código no encontrado", "error");
        return;
      }
      const uid     = snap.docs[0].id;
      const nombre  = snap.docs[0].data().nombre || 'Alumno';
      const fechaCR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });

      // setDoc con merge: crea si no existe, o actualiza si ya está
      await setDoc(doc(db, "asistencias", fechaCR, "usuarios", uid), {
        presente: true,
        hora: new Intl.DateTimeFormat('es-CR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica' }).format(new Date()),
        nombre
      }, { merge: true });

      showAlert(`Asistencia marcada: ${nombre}`, "success");
      e.target.reset();
    } catch (err) {
      console.error(err);
      showAlert("Error al marcar asistencia", "error");
    }
  });

  // ── 2) Generar QR de clase
  const qrCanvas = document.getElementById("qrcode");
  const btnQR    = document.getElementById("btnGenQR");

  async function ensureQRCodeLib() {
    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') return true;
    // Carga de respaldo por si el CDN no se cacheó aún
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src   = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return !!(window.QRCode && window.QRCode.toCanvas);
    } catch (e) {
      console.warn('No se pudo cargar la librería QRCode:', e);
      return false;
    }
  }

  btnQR?.addEventListener("click", async () => {
    const ok = await ensureQRCodeLib();
    if (!ok) {
      showAlert("No se pudo cargar el generador de QR.", "error");
      return;
    }
    const fechaCR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
    const payload = JSON.stringify({ fecha: fechaCR });

    window.QRCode.toCanvas(qrCanvas, payload, { width: 260 }, (err) => {
      if (err) {
        console.error("QR error:", err);
        showAlert("No se pudo generar el QR", "error");
      } else {
        showAlert("QR generado", "success");
      }
    });
  });
});
