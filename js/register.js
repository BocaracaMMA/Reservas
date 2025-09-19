// ./js/register.js (versión segura con unicidad de cédula)
import { app } from './firebase-config.js';
import {
  getAuth, createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, writeBatch, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth(app);
const db   = getFirestore(app);

const form   = document.getElementById("registerForm");
const nameI  = document.getElementById("nombre");
const idI    = document.getElementById("cedula");
const phoneI = document.getElementById("phone");
const emailI = document.getElementById("email");
const passI  = document.getElementById("password");
const btn    = form?.querySelector('button[type="submit"]');

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
    case "auth/email-already-in-use": return "Este correo ya está registrado.";
    case "auth/weak-password":        return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-email":        return "El correo no es válido.";
    case "auth/network-request-failed": return "Sin conexión estable. Verifica tu internet e intenta de nuevo.";
    default: return "No se pudo completar el registro. Intenta otra vez.";
  }
}

const online = () => navigator.onLine;

nameI?.addEventListener('input', () => {
  nameI.value = nameI.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+/g, ' ').trimStart();
});
idI?.addEventListener('input', () => {
  idI.value = idI.value.replace(/\D+/g, '').slice(0, 9);
});
phoneI?.addEventListener('input', () => {
  phoneI.value = phoneI.value.replace(/\D+/g, '').slice(0, 8);
});

async function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!online()) { showToast("Estás sin conexión. Conéctate e intenta de nuevo.", "error"); return; }

  const nombre   = (nameI?.value || '').trim();
  const cedula   = (idI?.value   || '').trim();
  const celular  = (phoneI?.value|| '').trim();
  const correo   = (emailI?.value|| '').trim().toLowerCase();
  const password = (passI?.value || '');

  // Validaciones espejo de reglas
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(nombre)) { showToast("El nombre solo debe contener letras y espacios.", "error"); return; }
  if (!/^\d{9}$/.test(cedula))                      { showToast("La cédula debe tener 9 dígitos.", "error"); return; }
  if (!/^\d{8}$/.test(celular))                     { showToast("El celular debe tener 8 dígitos.", "error"); return; }
  if (!correo || !password)                         { showToast("Completa correo y contraseña.", "error"); return; }

  btn?.setAttribute('disabled','true');

  let createdUser = null;
  try {
    // 1) Crear cuenta Auth
    const cred = await withTimeout(createUserWithEmailAndPassword(auth, correo, password));
    createdUser = cred.user;

    // 2) Batch atómico: primero índice de cédula, luego /users/{uid}
    const batch = writeBatch(db);

    const idxRef = doc(db, 'cedula_index', cedula);      // ID = cédula
    batch.set(idxRef, { uid: createdUser.uid, createdAt: serverTimestamp() });

    const userRef = doc(db, 'users', createdUser.uid);
    batch.set(userRef, {
      uid: createdUser.uid,
      nombre,
      cedula,
      celular,
      correo,
      autorizado: false,
      reservas: 0,
      createdAt: new Date().toISOString(),
      roles: ["student"],
      genero: "no_especificado",
      birthDate: null
    });

    await withTimeout(batch.commit());

    // 3) Verificación de email (no bloqueante)
    try { await sendEmailVerification(createdUser); } catch {}

    showToast("¡Cuenta creada! Revisa tu correo para verificar.", "success");

    // 4) Cerrar sesión y llevar a login (evita entrar sin perfil cargado)
    setTimeout(async () => {
      try { await signOut(auth); } catch {}
      window.location.href = './index.html';
    }, 1300);

  } catch (err) {
    console.error('[register] fallo en registro:', err);

    // Duplicado de cédula: la regla del índice lo impedirá y fallará el batch
    if (err?.message === 'timeout' || err?.code === 'deadline-exceeded') {
      showToast("La red está lenta. Intenta de nuevo.", "error");
    } else if (err?.code === 'permission-denied') {
      showToast("La cédula ya está registrada.", "error");
    } else if (err?.code?.startsWith('auth/')) {
      showToast(mapAuthError(err.code), "error");
    } else {
      showToast("No se pudo completar el registro. Intenta de nuevo.", "error");
    }

    // Limpieza: si creamos el usuario en Auth pero falló Firestore, lo borramos para no dejar cuenta “huérfana”
    try {
      if (createdUser && auth.currentUser && auth.currentUser.uid === createdUser.uid) {
        await deleteUser(auth.currentUser);
      }
    } catch {
      // si no se puede borrar (p.ej. offline), al menos cerramos sesión
      try { await signOut(auth); } catch {}
    }

  } finally {
    btn?.removeAttribute('disabled');
  }
});
