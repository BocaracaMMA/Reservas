// ./js/scan-asistencia.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

let scanner = null;
let isScanning = false;

const modal       = document.getElementById("scannerModal");
const readerDiv   = document.getElementById("reader");
const btnOpen     = document.getElementById("openScannerBtn");
const btnClose    = document.getElementById("btnCloseScanner");

// 1) Autenticación
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "index.html";
});

// 2) Toggle sidebar (si aplica)
;(function(){
  const t = document.getElementById("toggleNav");
  const s = document.getElementById("sidebar");
  if (t && s) t.addEventListener("click", ()=> s.classList.toggle("active"));
})();

// 3) Mostrar modal y arrancar cámara
btnOpen.addEventListener("click", async () => {
  modal.classList.add("active");
  if (!scanner) {
    scanner = new Html5Qrcode("reader");
  }
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      onScanSuccess,
      () => {}  // ignorar errores de frame
    );
    isScanning = true;
  } catch (err) {
    console.error("No se pudo iniciar escáner:", err);
    showAlert("Error al iniciar escáner", "error");
  }
});

// 4) Cerrar modal / detener cámara
btnClose.addEventListener("click", async () => {
  await stopScanner();
  modal.classList.remove("active");
});

// 5) Función de éxito en escaneo
async function onScanSuccess(decodedText) {
  if (!isScanning) return;
  // Detenemos antes de procesar
  await stopScanner();
  modal.classList.remove("active");

  let payload;
  try {
    payload = JSON.parse(decodedText);
  } catch {
    showAlert("QR no válido", "error");
    return;
  }

  const { fecha } = payload;
  const user = auth.currentUser;
  if (!fecha || !user) {
    showAlert("Datos de QR incorrectos", "error");
    return;
  }

  try {
    const ref = doc(db, "asistencias", fecha, "usuarios", user.uid);
    await updateDoc(ref, { presente: true });
    showAlert("¡Asistencia registrada!", "success");
  } catch (err) {
    console.error("Error registrando asistencia:", err);
    showAlert("Fallo al registrar asistencia", "error");
  }
}

// 6) Función para detener y limpiar
async function stopScanner() {
  if (!scanner || !isScanning) return;
  try {
    await scanner.stop();
    scanner.clear();
  } catch (e) {
    console.warn("Error al detener escáner:", e);
  }
  isScanning = false;
}
