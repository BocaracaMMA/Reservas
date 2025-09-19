// ./js/scan-asistencia.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

let scanner = null;
let isScanning = false;

const modal     = document.getElementById("scannerModal");
const readerDiv = document.getElementById("reader");
const btnOpen   = document.getElementById("openScannerBtn");
const btnClose  = document.getElementById("btnCloseScanner");

// 1) Auth guard
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "index.html";
});

// 2) Toggle sidebar (si existe)
(() => {
  const t = document.getElementById("toggleNav");
  const s = document.getElementById("sidebar");
  if (t && s) t.addEventListener("click", ()=> s.classList.toggle("active"));
})();

// 3) Abrir modal e iniciar cámara
btnOpen.addEventListener("click", async () => {
  modal.classList.add("active");
  if (!scanner) {
    scanner = new Html5Qrcode("reader");
  }
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 260 }, // qrbox levemente más grande
      onScanSuccess,
      () => {} // ignorar errores de frame
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

/* ──────────────────────────────────────────────────────────────────────────
   Animación y sonido de éxito
   - ✓ más grande (7rem), con leve glow
   - Sonido “ding” sin archivos externos (Web Audio API)
   ────────────────────────────────────────────────────────────────────────── */

async function playSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return; // por si el navegador no soporta

    const ctx = new AudioCtx();
    // iOS requiere resume después de interacción; intentamos por si está suspendido
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }

    // Pequeño “ding-ding”: dos tonos cortos encadenados
    const now = ctx.currentTime;

    const makeBeep = (time, freq, dur = 0.12, gainPeak = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(gainPeak, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    };

    // primer beep (Mi5 ~ 659 Hz), luego Sol5 ~ 784 Hz
    makeBeep(now,        659);
    makeBeep(now + 0.13, 784);

    // Cerrar el contexto un rato después para liberar
    setTimeout(() => ctx.close().catch(()=>{}), 500);
  } catch (e) {
    // si algo falla, no rompemos el flujo
    console.warn("No se pudo reproducir sonido:", e);
  }
}

function showSuccessAnimation() {
  return new Promise(resolve => {
    const wrap = modal.querySelector(".modal-content") || modal;

    const check = document.createElement("div");
    check.textContent = "✓";
    Object.assign(check.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(0)",
      fontSize: "7rem",             // ← más grande
      lineHeight: "1",
      color: "#2ea043",             // verde GitHub
      textShadow: "0 0 14px rgba(46,160,67,.6)",
      zIndex: 2000,
      pointerEvents: "none",
      fontWeight: "800"
    });
    wrap.appendChild(check);

    const anim = check.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)",   opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1.15)",opacity: 1, offset: 0.6 },
        { transform: "translate(-50%, -50%) scale(1)",   opacity: 1 }
      ],
      { duration: 650, easing: "cubic-bezier(.2,.9,.2,1)" }
    );

    anim.onfinish = () => { check.remove(); resolve(); };
  });
}

/* ────────────────────────────────────────────────────────────────────────── */

// 5) Éxito de escaneo
async function onScanSuccess(decodedText) {
  if (!isScanning) return;
  await stopScanner(); // detener antes de procesar

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

    // Animación + sonido y luego cerrar modal
    await Promise.all([ showSuccessAnimation(), playSuccessSound() ]);
    modal.classList.remove("active");
    showAlert("¡Asistencia registrada!", "success");
  } catch (err) {
    console.error("Error registrando asistencia:", err);
    showAlert("Fallo al registrar asistencia", "error");
  }
}

// 6) Detener y limpiar escáner
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
