// ./js/profile.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged, updateProfile }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ───────────── Sidebar ───────────── */
(function setupSidebarToggle() {
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (btn && sb) btn.addEventListener('click', () => sb.classList.toggle('active'));
})();

/* ───────────── Logout ───────────── */
const logoutBtn = document.getElementById('logoutSidebar');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await signOut(auth); showAlert('Sesión cerrada', 'success'); }
    catch { showAlert('Error al cerrar sesión', 'error'); }
    finally { setTimeout(() => location.href = 'index.html', 800); }
  });
}

/* ───────────── Utilidades ───────────── */
const setText = (el, v='—') => { if (el) el.textContent = v; };
const setVal  = (el, v='')   => { if (el) el.value = v; };

function crToday() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
}
function daysUntil(dateStr) {
  if (!dateStr) return -9999;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.floor((target - crToday()) / (1000 * 60 * 60 * 24));
}
function computeState(user) {
  if (!user?.autorizado) return { label: 'Vencida', cls: 'error' };
  const left = daysUntil(user?.expiryDate);
  if (left < 0)  return { label: 'Vencida', cls: 'error' };
  if (left <= 5) return { label: 'Por Vencer', cls: 'warn' };
  return { label: 'Activa', cls: 'success' };
}
function initialsFrom(name = '', last = '') {
  const a = (name || '').trim().charAt(0);
  const b = (last || '').trim().charAt(0);
  return (a + b || 'U').toUpperCase();
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: '2-digit' });
  } catch { return dateStr; }
}
// Normaliza cédula a solo dígitos
function normalizeCedula(raw = '') {
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length < 8 || digits.length > 20) return null;
  return digits;
}
// Valida nacimiento razonable
function validBirthDate(iso) {
  if (!iso) return true; // opcional
  const d = new Date(iso);
  const now = crToday();
  const min = new Date(1900, 0, 1);
  return !Number.isNaN(d.valueOf()) && d >= min && d <= now;
}

/* ───────────── Referencias UI ───────────── */
const displayEl  = document.getElementById('pfDisplay');
const emailChip  = document.getElementById('pfEmail');
const planChip   = document.getElementById('pfPlan');
const statusChip = document.getElementById('pfStatus');

const pfNombre      = document.getElementById('pfNombre');
const pfApellidos   = document.getElementById('pfApellidos');
const pfCorreo      = document.getElementById('pfCorreo');
const pfCedula      = document.getElementById('pfCedula');
const pfMembresia   = document.getElementById('pfMembresia');
const pfEstado      = document.getElementById('pfEstado');
const pfExpira      = document.getElementById('pfExpira');
const pfGenero      = document.getElementById('pfGenero');
const pfNacimiento  = document.getElementById('pfNacimiento');

const editBtn       = document.getElementById('pfEdit');
const editForm      = document.getElementById('editForm');
const efNombre      = document.getElementById('efNombre');
const efApellidos   = document.getElementById('efApellidos');
const efCedula      = document.getElementById('efCedula');
const efGenero      = document.getElementById('efGenero');
const efNacimiento  = document.getElementById('efNacimiento');
const efCancel      = document.getElementById('efCancel');

let CURRENT_UID = null;

/* ───────────── Carga de perfil ───────────── */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = './index.html'; return; }
  CURRENT_UID = user.uid;

  const ref  = doc(db, 'users', CURRENT_UID);
  const snap = await getDoc(ref);
  const u    = snap.exists() ? snap.data() : {};

  // Datos base
  const nombre    = u.nombre || user.displayName?.split(' ')?.[0] || '—';
  const apellidos = u.apellidos || user.displayName?.split(' ')?.slice(1).join(' ') || '—';
  const correo    = u.correo || user.email || '—';
  const plan      = u.membresia || u.membershipType || 'General';
  const expiry    = u.expiryDate || '—';
  const cedula    = u.cedula || '—';
  const gender    = u.gender || '';     // masculino/femenino/no_binario/prefiero_no_decir
  const birthDate = u.birthDate || '';  // YYYY-MM-DD
  const state     = computeState(u);

  // Header (todos seguros)
  setText(displayEl, `${nombre} ${apellidos}`.trim());
  setText(emailChip, correo);

  if (planChip) { planChip.textContent = plan; planChip.className = 'tag info'; }
  if (statusChip) { statusChip.textContent = state.label; statusChip.className = `tag ${state.cls}`; }

  // Grid
  setText(pfNombre,     nombre);
  setText(pfApellidos,  apellidos);
  setText(pfCorreo,     correo);
  setText(pfCedula,     cedula);
  setText(pfMembresia,  plan);
  setText(pfEstado,     state.label);
  setText(pfExpira,     formatDate(expiry));
  setText(pfGenero,     gender ? ({
    masculino: 'Masculino',
    femenino: 'Femenino',
    no_binario: 'No binario',
    prefiero_no_decir: 'Prefiero no decir'
  }[gender] || '—') : '—');
  setText(pfNacimiento, birthDate ? formatDate(birthDate) : '—');

  // Prefill edición
  setVal(efNombre,     (nombre === '—') ? '' : nombre);
  setVal(efApellidos,  (apellidos === '—') ? '' : apellidos);
  setVal(efCedula,     (cedula === '—') ? '' : cedula);
  setVal(efGenero,     gender || '');
  setVal(efNacimiento, birthDate || '');
});

/* ───────────── Toggle edición ───────────── */
editBtn?.addEventListener('click', () => {
  if (!editForm) return;
  editForm.hidden = !editForm.hidden;
  if (!editForm.hidden) efNombre?.focus();
});
efCancel?.addEventListener('click', () => { if (editForm) editForm.hidden = true; });

/* ───────────── Guardar edición ───────────── */
editForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre     = efNombre?.value.trim()    ?? '';
  const apellidos  = efApellidos?.value.trim() ?? '';
  const rawCedula  = efCedula?.value.trim()    ?? '';
  const gender     = efGenero?.value           ?? '';
  const birthDate  = efNacimiento?.value       ?? '';

  if (!nombre) { showAlert('El nombre es obligatorio', 'error'); return; }

  // Cédula
  let cedulaToSave = '';
  if (rawCedula) {
    const norm = normalizeCedula(rawCedula);
    if (norm === null) {
      showAlert('La cédula debe tener entre 8 y 20 dígitos (solo números).', 'error');
      return;
    }
    cedulaToSave = norm;
  }

  // Nacimiento
  if (birthDate && !validBirthDate(birthDate)) {
    showAlert('Fecha de nacimiento inválida.', 'error');
    return;
  }

  try {
    const ref = doc(db, 'users', CURRENT_UID);

    // Construye payload y guarda/crea
    const payload = { nombre, apellidos };
    if (cedulaToSave || rawCedula === '') payload.cedula = cedulaToSave; // permite borrar si quedó vacío
    if (gender)      payload.gender = gender;
    if (birthDate)   payload.birthDate = birthDate;

    await setDoc(ref, payload, { merge: true });

    // Actualiza displayName de Auth (opcional)
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: `${nombre} ${apellidos}`.trim() });
    }

    // Refleja en UI (seguros)
    setText(displayEl, `${nombre} ${apellidos}`.trim());
    setText(pfNombre, nombre);
    setText(pfApellidos, apellidos || '—');
    setText(pfCedula, cedulaToSave || '—');
    setText(pfGenero, gender ? ({
      masculino: 'Masculino',
      femenino: 'Femenino',
      no_binario: 'No binario',
      prefiero_no_decir: 'Prefiero no decir'
    }[gender]) : '—');
    setText(pfNacimiento, birthDate ? formatDate(birthDate) : '—');

    showAlert('Perfil actualizado', 'success');
    if (editForm) editForm.hidden = true;
  } catch (err) {
    console.error(err);
    showAlert('No se pudo actualizar el perfil', 'error');
  }
});
