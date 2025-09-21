// ./js/register.js — registro con contraseña mín. 8, loader y anti-doble submit
import { app } from './firebase-config.js';
import {
  getAuth, createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, writeBatch, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// ------- UI helpers -------
const form   = document.getElementById("registerForm");
const nameI  = document.getElementById("nombre");
const lastI  = document.getElementById("apellidos");
const tipoI  = document.getElementById("cedulaTipo");
const crI    = document.getElementById("cedula");
const extI   = document.getElementById("cedulaExtranjera");
const phoneI = document.getElementById("phone");
const emailI = document.getElementById("email");
const passI  = document.getElementById("password");
const genI   = document.getElementById("genero");
const bdayI  = document.getElementById("birthDate");
const submitBtn = form?.querySelector('button[type="submit"]');

function showToast(msg, type="success") {
  if (window.showAlert) return window.showAlert(msg, type); // usa tu toast global si existe
  let c = document.getElementById("toast-container");
  if (!c) { c = document.createElement('div'); c.id="toast-container"; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t);
  setTimeout(()=>t.remove(), 4000);
}

// ------- Loader de pantalla (inserta CSS y markup una sola vez) -------
(function mountLoader(){
  if (document.getElementById('screen-loader')) return;
  const style = document.createElement('style');
  style.textContent = `
  #screen-loader{position:fixed;inset:0;display:none;place-items:center;z-index:2000;
    background:rgba(10,15,20,.55);backdrop-filter:saturate(140%) blur(2px);}
  #screen-loader .box{display:grid;gap:10px;place-items:center;padding:16px 18px;border-radius:12px;
    background:#0f141a;border:1px solid rgba(255,255,255,.08);}
  #screen-loader .spin{width:36px;height:36px;border:3px solid rgba(255,255,255,.25);
    border-top-color:#58a6ff;border-radius:50%;animation:spin .9s linear infinite}
  #screen-loader p{margin:0;color:#c9d1d9;font-size:.95rem}
  @keyframes spin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'screen-loader';
  el.innerHTML = `<div class="box"><div class="spin"></div><p>Procesando…</p></div>`;
  document.body.appendChild(el);
})();
const showLoader = (on)=> {
  const el = document.getElementById('screen-loader');
  if (el) el.style.display = on ? 'grid' : 'none';
};

const online = () => navigator.onLine;

// ------- Normalizaciones y máscaras -------
nameI?.addEventListener('input', () => {
  nameI.value = nameI.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+/g, ' ').trimStart();
});
lastI?.addEventListener('input', () => {
  lastI.value = lastI.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+/g, ' ').trimStart();
});
crI?.addEventListener('input', () => {
  crI.value = crI.value.replace(/\D+/g, '').slice(0, 9);
});
extI?.addEventListener('input', () => {
  extI.value = extI.value.replace(/[^A-Za-z0-9-]+/g, '').slice(0, 20);
});
phoneI?.addEventListener('input', () => {
  phoneI.value = phoneI.value.replace(/\D+/g, '').slice(0, 8);
});

// Muestra/oculta los campos según el tipo de identificación
function toggleIdInputs() {
  const isCR = (tipoI?.value || 'nacional') === 'nacional';
  document.getElementById('wrapCedulaCR')?.classList.toggle('hidden', !isCR);
  document.getElementById('wrapCedulaExt')?.classList.toggle('hidden', isCR);
}
tipoI?.addEventListener('change', toggleIdInputs);
toggleIdInputs();

// Timeout para promesas “colgadas”
async function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

// Mapeo de errores Auth
function mapAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":   return "Este correo ya está registrado.";
    case "auth/invalid-email":          return "El correo no es válido.";
    case "auth/network-request-failed": return "Conexión inestable. Inténtalo de nuevo.";
    case "auth/weak-password":          return "La contraseña es muy débil.";
    default:                            return "No se pudo completar el registro.";
  }
}

// ------- Anti-doble submit -------
let inFlight = false;

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (inFlight) return; // ignora clics repetidos
  if (!online()) { showToast("Estás sin conexión. Conéctate e intenta de nuevo.", "error"); return; }

  const nombre   = (nameI?.value || '').trim();
  const apellidos= (lastI?.value || '').trim();
  const tipo     = (tipoI?.value || 'nacional');
  const cedula   = (crI?.value   || '').trim();
  const cedulaEx = (extI?.value  || '').trim();
  const celular  = (phoneI?.value|| '').trim();
  const correo   = (emailI?.value|| '').trim().toLowerCase();
  const password = (passI?.value || '');
  const genero   = (genI?.value  || 'no_especificado');
  const birth    = (bdayI?.value || ''); // YYYY-MM-DD o ''

  // ===== Validaciones locales (reflejan reglas) =====
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(nombre))   { showToast("El nombre solo debe contener letras y espacios.", "error"); return; }
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(apellidos)) { showToast("Los apellidos solo deben contener letras y espacios.", "error"); return; }

  if (tipo === 'nacional') {
    if (!/^\d{9}$/.test(cedula))                      { showToast("La cédula (CR) debe tener 9 dígitos.", "error"); return; }
  } else {
    if (!(cedulaEx.length >= 6 && cedulaEx.length <= 20 && /^[A-Za-z0-9-]+$/.test(cedulaEx))) {
      showToast("Documento extranjero inválido (6–20, letras/números/guiones).", "error"); return;
    }
  }

  if (!/^\d{8}$/.test(celular))                       { showToast("El celular debe tener 8 dígitos.", "error"); return; }
  if (!correo)                                       { showToast("Ingresa un correo válido.", "error"); return; }

  // 🔒 Nueva política: mínimo 8 caracteres
  if (password.length < 8) {
    showToast("La contraseña debe tener al menos 8 caracteres.", "error");
    return;
  }

  // Si viene fecha, que tenga formato YYYY-MM-DD (opcional)
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    showToast("La fecha de nacimiento no es válida.", "error"); return;
  }

  // Lock UI
  inFlight = true;
  submitBtn?.setAttribute('disabled','true');
  Array.from(form.elements).forEach(el => el.disabled = true);
  showLoader(true);

  let createdUser = null;
  try {
    // 1) Crear cuenta en Auth
    const cred = await withTimeout(createUserWithEmailAndPassword(auth, correo, password));
    createdUser = cred.user;

    // 2) Batch atómico: índice de cédula (si nacional) + users/{uid}
    const batch = writeBatch(db);

    if (tipo === 'nacional') {
      const idxRef = doc(db, 'cedula_index', cedula); // ID = cédula (evita duplicados)
      batch.set(idxRef, { uid: createdUser.uid, createdAt: serverTimestamp() });
    }

    const userRef = doc(db, 'users', createdUser.uid);
    const userDoc = {
      uid: createdUser.uid,
      nombre, apellidos,
      cedula: (tipo === 'nacional') ? cedula : undefined,
      cedulaTipo: tipo,
      cedulaExtranjera: (tipo === 'extranjera') ? cedulaEx : undefined,
      celular, correo,
      autorizado: false,
      reservas: 0,
      createdAt: new Date().toISOString(),
      roles: ["student"],
      genero,
      birthDate: birth || undefined
    };
    // Limpia undefined para no romper reglas “opcionales”
    Object.keys(userDoc).forEach(k => userDoc[k] === undefined && delete userDoc[k]);

    batch.set(userRef, userDoc);
    await withTimeout(batch.commit());

    // 3) Verificar email (no bloqueante)
    try { await sendEmailVerification(createdUser); } catch {}

    showToast("¡Cuenta creada! Revisa tu correo para verificar.", "success");

    // 4) Salir y volver al login (evita estados intermedios)
    setTimeout(async () => {
      try { await signOut(auth); } catch {}
      window.location.href = './index.html';
    }, 1200);

  } catch (err) {
    console.error('[register] fallo en registro:', err);

    if (err?.message === 'timeout' || err?.code === 'deadline-exceeded') {
      showToast("La red está lenta. Intenta de nuevo.", "error");
    } else if (err?.code === 'permission-denied') {
      // podría ser cédula duplicada u otra validación de reglas
      showToast("No se pudo crear el perfil (posible cédula duplicada).", "error");
    } else if (err?.code?.startsWith('auth/')) {
      showToast(mapAuthError(err.code), "error");
    } else {
      showToast("No se pudo completar el registro. Intenta otra vez.", "error");
    }

    // Limpieza: si Auth se creó pero Firestore falló → borra usuario para no dejarlo “huérfano”
    try {
      if (createdUser && auth.currentUser && auth.currentUser.uid === createdUser.uid) {
        await deleteUser(auth.currentUser);
      }
    } catch {
      try { await signOut(auth); } catch {}
    }

  } finally {
    showLoader(false);
    submitBtn?.removeAttribute('disabled');
    Array.from(form.elements).forEach(el => el.disabled = false);
    inFlight = false;
  }
});
