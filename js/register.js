// ./js/register.js — email (usuario + dominio con menú), approved:false y validaciones
import { app } from './firebase-config.js';
import {
  getAuth, createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, writeBatch, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// ===== UI refs =====
const form   = document.getElementById("registerForm");
const nameI  = document.getElementById("nombre");
const lastI  = document.getElementById("apellidos");
const tipoI  = document.getElementById("cedulaTipo");
const crI    = document.getElementById("cedula");
const extI   = document.getElementById("cedulaExtranjera");
const phoneI = document.getElementById("phone");

// Email (look input-group con tus clases)
const emailLocalI   = document.getElementById("emailLocal");          // input izquierdo
const emailDomainBtn= document.getElementById("emailDomainBtn");      // botón derecho (clase .email-addon)
const emailDomainTxt= document.getElementById("emailDomainText");     // span dentro del botón
const emailMenu     = document.getElementById("emailMenu");           // <ul class="email-menu">
const emailFull     = document.getElementById("emailFull");           // <input type="hidden" id="emailFull">

// Password + otros
const passI  = document.getElementById("password");
const genI   = document.getElementById("genero");
const bdayI  = document.getElementById("birthDate");
const submitBtn = form?.querySelector('button[type="submit"]');

// ===== Toast =====
function showToast(msg, type="success") {
  if (window.showAlert) return window.showAlert(msg, type);
  let c = document.getElementById("toast-container");
  if (!c) { c = document.createElement('div'); c.id="toast-container"; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t);
  setTimeout(()=>t.remove(), 4000);
}

// ===== Loader (mínimo, reaprovecha tu estilo global si existe) =====
(function mountLoader(){
  if (document.getElementById('screen-loader')) return;
  const el = document.createElement('div');
  el.id = 'screen-loader';
  el.style.cssText = "position:fixed;inset:0;display:none;place-items:center;z-index:2000;background:rgba(10,15,20,.55);backdrop-filter:saturate(140%) blur(2px);";
  el.innerHTML = `<div class="box" style="display:grid;gap:10px;place-items:center;padding:16px 18px;border-radius:12px;background:#0f141a;border:1px solid rgba(255,255,255,.08);">
    <div class="spin" style="width:36px;height:36px;border:3px solid rgba(255,255,255,.25);border-top-color:#58a6ff;border-radius:50%;animation:spin .9s linear infinite"></div>
    <p style="margin:0;color:#c9d1d9;font-size:.95rem">Procesando…</p>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(el);
})();
const showLoader = (on)=> {
  const el = document.getElementById('screen-loader');
  if (el) el.style.display = on ? 'grid' : 'none';
};

// ===== Máscaras / normalizaciones =====
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

// Tipo de identificación
function toggleIdInputs() {
  const isCR = (tipoI?.value || 'nacional') === 'nacional';
  document.getElementById('wrapCedulaCR')?.classList.toggle('hidden', !isCR);
  document.getElementById('wrapCedulaExt')?.classList.toggle('hidden', isCR);
}
tipoI?.addEventListener('change', toggleIdInputs);
toggleIdInputs();

// ====== Email group ======

// Dominios permitidos (se pueden añadir más aquí o desde el HTML <ul>)
const DEFAULT_DOMAINS = [
  'gmail.com','gmail.es','hotmail.com','hotmail.es',
  'outlook.com','outlook.es','yahoo.com','icloud.com','proton.me','live.com'
];

// Construye el set de dominios a partir del menú (si existe)
function getAllowedDomains(){
  const items = emailMenu ? Array.from(emailMenu.querySelectorAll('[data-domain]')) : [];
  const fromDOM = items.map(li => String(li.dataset.domain || '').toLowerCase()).filter(Boolean);
  return Array.from(new Set([...(fromDOM.length ? fromDOM : DEFAULT_DOMAINS)]));
}
let ALLOWED_DOMAINS = getAllowedDomains();

// Sanea el “local-part” (antes de @)
emailLocalI?.addEventListener('input', () => {
  let v = (emailLocalI.value || '').toLowerCase();

  // si pegan todo el correo, corta en el '@'
  v = v.split('@')[0];

  // quita espacios y caracteres no permitidos típicos en el local-part
  // permitimos letras, números, . _ + -
  v = v.replace(/[^a-z0-9._+\-]/g, '');

  // elimina dominios comunes pegados al final (p.ej. "juan.garcia@gmail.com")
  ALLOWED_DOMAINS.forEach(dom => {
    const rx = new RegExp(String(dom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    v = v.replace(rx, '');
  });

  // evita dobles puntos o punto al inicio/fin
  v = v.replace(/\.\.+/g, '.').replace(/^\./, '').replace(/\.$/, '');

  emailLocalI.value = v.slice(0, 64);
  updateEmailHidden();
});

// Abre/cierra menú
function toggleMenu(show){
  if (!emailMenu) return;
  const willShow = (typeof show === 'boolean') ? show : emailMenu.hasAttribute('hidden');
  if (willShow){
    emailMenu.removeAttribute('hidden');
    emailDomainBtn?.setAttribute('aria-expanded','true');
  }else{
    emailMenu.setAttribute('hidden','');
    emailDomainBtn?.setAttribute('aria-expanded','false');
  }
}

// Click en botón dominio
emailDomainBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  toggleMenu();
});

// Click en opción del menú
emailMenu?.addEventListener('click', (e)=>{
  const li = e.target.closest('[data-domain]');
  if (!li) return;
  const dom = String(li.dataset.domain || '').toLowerCase();
  if (!dom) return;
  emailDomainTxt.textContent = dom;
  toggleMenu(false);
  ALLOWED_DOMAINS = getAllowedDomains(); // refresca por si cambiaste lista
  updateEmailHidden();
});

// Cerrar al hacer click fuera
document.addEventListener('click', (e)=>{
  if (!emailMenu || emailMenu.hasAttribute('hidden')) return;
  const inGroup = e.target === emailMenu || emailMenu.contains(e.target)
               || e.target === emailDomainBtn || emailDomainBtn?.contains(e.target);
  if (!inGroup) toggleMenu(false);
});
// Esc para cerrar
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') toggleMenu(false);
});

// Compone email y valida
function buildEmail() {
  const local  = (emailLocalI?.value || '').trim().toLowerCase();
  const domain = (emailDomainTxt?.textContent || '').trim().toLowerCase();

  const localOk =
    local.length >= 1 && local.length <= 64 &&
    !/[@\s]/.test(local) &&
    !/^\./.test(local) && !/\.$/.test(local) &&
    !/\.\./.test(local);

  if (!localOk) return { ok:false, reason:'local' };
  if (!ALLOWED_DOMAINS.includes(domain)) return { ok:false, reason:'domain' };

  return { ok:true, email: `${local}@${domain}` };
}
function updateEmailHidden(){
  const res = buildEmail();
  if (emailFull) emailFull.value = res.ok ? res.email : '';
}

// ===== util =====
async function withTimeout(p, ms=20000){
  return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]);
}
function mapAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":   return "Este correo ya está registrado.";
    case "auth/invalid-email":          return "El correo no es válido.";
    case "auth/network-request-failed": return "Conexión inestable. Inténtalo de nuevo.";
    case "auth/weak-password":          return "La contraseña es muy débil.";
    default:                            return "No se pudo completar el registro.";
  }
}

// ===== Submit =====
let inFlight = false;

form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (inFlight) return;

  const nombre    = (nameI?.value || '').trim();
  const apellidos = (lastI?.value || '').trim();
  const tipo      = (tipoI?.value || 'nacional');
  const cedula    = (crI?.value   || '').trim();
  const cedulaEx  = (extI?.value  || '').trim();
  const celular   = (phoneI?.value|| '').trim();
  const correoObj = buildEmail();
  const password  = (passI?.value || '');
  const genero    = (genI?.value  || 'no_especificado');
  const birth     = (bdayI?.value || '');

  // Validaciones
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(nombre))   { showToast("El nombre solo debe contener letras y espacios.", "error"); return; }
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(apellidos)) { showToast("Los apellidos solo deben contener letras y espacios.", "error"); return; }

  if (tipo === 'nacional') {
    if (!/^\d{9}$/.test(cedula)) { showToast("La cédula (CR) debe tener 9 dígitos.", "error"); return; }
  } else {
    if (!(cedulaEx.length >= 6 && cedulaEx.length <= 20 && /^[A-Za-z0-9-]+$/.test(cedulaEx))) {
      showToast("Documento extranjero inválido (6–20, letras/números/guiones).", "error"); return;
    }
  }

  if (!/^\d{8}$/.test(celular)) { showToast("El celular debe tener 8 dígitos.", "error"); return; }

  if (!correoObj.ok) {
    showToast(
      correoObj.reason === 'local'
        ? "Revisa la parte antes de @ (sin espacios ni puntos al inicio/fin)."
        : "Selecciona un dominio válido.",
      "error"
    );
    return;
  }
  const correo = correoObj.email;

  if (password.length < 8) { showToast("La contraseña debe tener al menos 8 caracteres.", "error"); return; }
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) { showToast("La fecha de nacimiento no es válida.", "error"); return; }

  // Lock UI
  inFlight = true;
  submitBtn?.setAttribute('disabled','true');
  Array.from(form.elements).forEach(el => el.disabled = true);
  showLoader(true);

  let createdUser = null;
  try {
    // 1) Auth
    const cred = await withTimeout(createUserWithEmailAndPassword(auth, correo, password));
    createdUser = cred.user;

    // 2) Firestore
    const batch = writeBatch(db);

    if (tipo === 'nacional') {
      const idxRef = doc(db, 'cedula_index', cedula); // ID=cédula para evitar duplicados
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
      approved: false,     // ← pendiente para aparecer en admin-usuarios
      autorizado: false,   // ← aún no autorizado para reservar
      reservas: 0,
      createdAt: new Date().toISOString(),
      roles: ["student"],
      genero,
      birthDate: birth || undefined
    };
    Object.keys(userDoc).forEach(k => userDoc[k] === undefined && delete userDoc[k]);

    batch.set(userRef, userDoc);
    await withTimeout(batch.commit());

    // 3) Verificación de correo (no bloqueante)
    try { await sendEmailVerification(createdUser); } catch {}

    showToast("¡Cuenta creada! Revisa tu correo y espera aprobación.", "success");

    // 4) Salir al login
    setTimeout(async () => {
      try { await signOut(auth); } catch {}
      window.location.href = './index.html';
    }, 1200);

  } catch (err) {
    console.error('[register] fallo en registro:', err);
    if (err?.message === 'timeout' || err?.code === 'deadline-exceeded') {
      showToast("La red está lenta. Intenta de nuevo.", "error");
    } else if (err?.code === 'permission-denied') {
      showToast("No se pudo crear el perfil (posible cédula duplicada).", "error");
    } else if (err?.code?.startsWith('auth/')) {
      showToast(mapAuthError(err.code), "error");
    } else {
      showToast("No se pudo completar el registro. Intenta otra vez.", "error");
    }

    // Limpieza si Firestore falló después de crear Auth
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

// Valor inicial del email oculto
updateEmailHidden();
