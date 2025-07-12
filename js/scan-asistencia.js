// ./js/scan-asistencia.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// 1) Referencias a botones y contenedor
const readerId = "reader";
const btnStart = document.getElementById("btnStartScan");
const btnStop  = document.getElementById("btnStopScan");

// 2) Instancia única del escáner
const html5QrCode = new Html5Qrcode(readerId);
const qrConfig    = { fps: 10, qrbox: 250 };

// 3) Estado de escaneo
let isScanning = false;

// 4) Asegurar usuario
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = 'index.html';
});

// 5) Función para detener y limpiar
async function stopScanner() {
  if (!isScanning) return;
  isScanning = false;
  try {
    await html5QrCode.stop();   // primero detiene la cámara
    html5QrCode.clear();        // luego limpia el DOM del reader
  } catch (e) {
    console.warn("Error al detener/limpiar escáner:", e);
  }
  btnStart.disabled = false;
  btnStop.disabled  = true;
}

// 6) Éxito de un escaneo válido
async function onScanSuccess(decodedText) {
  // Solo procesar si está activo
  if (!isScanning) return;
  isScanning = false;

  // Detener antes de manejar datos
  await stopScanner();

  try {
    const { fecha } = JSON.parse(decodedText);
    const uid = auth.currentUser.uid;
    const ref = doc(db, "asistencias", fecha, "usuarios", uid);
    await updateDoc(ref, { presente: true });
    showAlert("¡Asistencia registrada!", "success");
  } catch (err) {
    console.error("Error procesando QR:", err);
    showAlert("Formato de QR inválido o fallo al registrar.", "error");
  }
}

// 7) No manejamos fallos de cada frame (evita toasts repetidos)
//    Lo tratamos como una única falla si se quiere:
/* function onScanFailure(error) {
     // noop
   } */

// 8) Iniciar escaneo
btnStart.addEventListener("click", async () => {
  if (isScanning) return;
  isScanning = true;
  btnStart.disabled = true;
  btnStop.disabled  = false;

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      qrConfig,
      onScanSuccess,    // solo éxito
      () => {}          // ignoramos fallos de frame
    );
    showAlert("Escáner iniciado", "success");
  } catch (err) {
    console.error("Error iniciando escáner:", err);
    showAlert("No se pudo iniciar el escáner", "error");
    // restablecer botones
    isScanning = false;
    btnStart.disabled = false;
    btnStop.disabled  = true;
  }
});

// 9) Detener manualmente
btnStop.addEventListener("click", async () => {
  await stopScanner();
  showAlert("Escáner detenido", "success");
});
