// ./js/register.js
import { app } from './firebase-config.js';
import {
  getAuth, createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, writeBatch, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// Referencias del form (si alguna no existe, el script sigue funcionando)
const form   = document.getElementById("registerForm");
const nameI  = document.getElementById("nombre");
const idI    = document.getElementById("cedula");
const phoneI = document.getElementById("phone");
const emailI = document.getElementById("email");
const passI  = document.getElementById("password");
const btn    = form?.querySelector('button[type="submit"]');

// UI helpers
function showToast(msg, type="success") {
  const c = document.getElementById("toast-container") || document.body;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(()=> t.remove(), 4000);
}
function mapAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":   return "Este correo ya está registrado.";
    case "auth/weak-password":          return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-email":          return "El correo no es válido.";
    case "auth/network-request-failed": return "Sin conexión estable. Verifica tu internet e intenta de nuevo.";
    default: return "No se pudo completar el registro. Intenta otra vez.";
  }
}
const online = () => navigator.onLine;

// Formato en tiempo real (si existen los inputs)
nameI?.addEventListener('input', () => {
  nameI.value = nameI.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+/g, ' ').trimStart();
});
idI?.addEventListener('input', () => {
  idI.value = idI.value.replace(/\D+/g, '').slice(0, 9);
});
phoneI?.addEventListener('input', () => {
  phoneI.value = phoneI.value.replace(/\D+/g, '').slice(0, 8);
});

// Util
async function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

// Validadores “opcionales” (solo si hay valor)
const isValidNombre  = (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{1,60}$/.test(v);
const isValidCedula  = (v) => /^\d{9}$/.test(v);
const isValidCelular = (v) => /^\d{8}$/.test(v);

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!online()) { showToast("Estás sin conexión. Conéctate e intenta de nuevo.", "error"); return; }

  const correo   = (emailI?.value||'').trim().toLowerCase();
  const password = (passI?.value || '');

  // Registro mínimo: email + password
  if (!correo || !password) { showToast("Completa correo y contraseña.", "error"); return; }

  // Campos opcionales (solo si existen inputs y traen algo)
  const nombre  = (nameI?.value  || '').trim();
  const cedula  = (idI?.value    || '').trim();
  const celular = (phoneI?.value || '').trim();

  // Si los trae, que sean válidos (pero NO son obligatorios)
  if (nombre  && !isValidNombre(nombre))   { showToast("El nombre solo debe contener letras y espacios.", "error"); return; }
  if (cedula  && !isValidCedula(cedula))   { showToast("La cédula debe tener 9 dígitos.", "error"); return; }
  if (celular && !isValidCelular(celular)) { showToast("El celular debe tener 8 dígitos.", "error"); return; }

  btn?.setAttribute('disabled','true');

  let createdUser = null;
  try {
    // 1) Crear en Auth
    const cred = await withTimeout(createUserWithEmailAndPassword(auth, correo, password));
    createdUser = cred.user;

    // 2) Batch atómico en Firestore
    const batch   = writeBatch(db);
    const userRef = doc(db, 'users', createdUser.uid);

    // Payload mínimo (cumple reglas relajadas de CREATE)
    const payload = {
      uid: createdUser.uid,
      correo,
      createdAt: new Date().toISOString(),
      roles: ["student"],
      autorizado: false,
      reservas: 0,
      gender: "no_especificado"
    };

    // Agregar opcionales si están y son válidos
    if (nombre)  payload.nombre  = nombre;
    if (cedula)  payload.cedula  = cedula;     // ya validamos 9 dígitos si vino
    if (celular) payload.celular = celular;

    batch.set(userRef, payload);

    // Índice de cédula SOLO si existe y es válida
    if (cedula && isValidCedula(cedula)) {
      const idxRef = doc(db, 'cedula_index', cedula); // id = cédula
      batch.set(idxRef, { uid: createdUser.uid, createdAt: serverTimestamp() });
    }

    await withTimeout(batch.commit());

    // 3) Verificación de email (no bloquea el flujo)
    try { await sendEmailVerification(createdUser); } catch {}

    showToast("¡Cuenta creada! Revisa tu correo para verificar.", "success");

    // 4) Cerrar sesión y enviar a login
    setTimeout(async () => {
      try { await signOut(auth); } catch {}
      window.location.href = './index.html';
    }, 1300);

  } catch (err) {
    console.error('[register] fallo en registro:', err);

    if (err?.message === 'timeout' || err?.code === 'deadline-exceeded') {
      showToast("La red está lenta. Intenta de nuevo.", "error");
    } else if (err?.code?.startsWith('auth/')) {
      showToast(mapAuthError(err.code), "error");
    } else if (err?.code === 'permission-denied') {
      // Lo más común aquí será índice de cédula duplicado
      showToast("No se pudo guardar el perfil (posible cédula duplicada).", "error");
    } else {
      showToast("No se pudo completar el registro. Intenta otra vez.", "error");
    }

    // Limpieza: si Auth se creó pero Firestore falló, borra usuario para no dejar “huérfano”
    try {
      if (createdUser && auth.currentUser && auth.currentUser.uid === createdUser.uid) {
        await deleteUser(auth.currentUser);
      }
    } catch {
      try { await signOut(auth); } catch {}
    }

  } finally {
    btn?.removeAttribute('disabled');
  }
});
