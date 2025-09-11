// ./js/profile.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged, updateProfile }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// Sidebar
(function setupSidebarToggle(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (btn && sb) btn.addEventListener('click', ()=> sb.classList.toggle('active'));
})();

// Logout
const logoutBtn = document.getElementById('logoutSidebar');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await signOut(auth); showAlert('Sesión cerrada','success'); }
    catch { showAlert('Error al cerrar sesión','error'); }
    finally { setTimeout(()=> location.href='index.html', 800); }
  });
}

// Utilidades fecha/estado
function crToday() {
  return new Date(new Date().toLocaleString('en-US',{ timeZone:'America/Costa_Rica'}));
}
function daysUntil(dateStr){ // YYYY-MM-DD
  if (!dateStr) return -9999;
  const [y,m,d] = dateStr.split('-').map(Number);
  const target  = new Date(y, m-1, d);
  return Math.floor( (target - crToday()) / (1000*60*60*24) );
}
function computeState(user) {
  if (!user?.autorizado) return { label:'Vencida', cls:'error' };
  const left = daysUntil(user?.expiryDate);
  if (left < 0)  return { label:'Vencida', cls:'error' };
  if (left <= 5) return { label:'Por Vencer', cls:'warn' }; // tus estados: Activa / Vencida / Por Vencer
  return { label:'Activa', cls:'success' };
}
function initialsFrom(name='', last='') {
  const a = (name||'').trim().charAt(0);
  const b = (last||'').trim().charAt(0);
  return (a+b || 'U').toUpperCase();
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y,m,d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('es-CR',
      { year:'numeric', month:'long', day:'2-digit' });
  } catch { return dateStr; }
}
// Normaliza cédula a solo dígitos; válida 8–20 (coincide con reglas)
function normalizeCedula(raw='') {
  const digits = String(raw).replace(/\D+/g,'');
  if (!digits) return ''; // opcional
  if (digits.length < 8 || digits.length > 20) return null; // inválida
  return digits;
}

// Referencias UI
const avatarEl   = document.getElementById('pfAvatar');
const displayEl  = document.getElementById('pfDisplay');
const emailChip  = document.getElementById('pfEmail');
const planChip   = document.getElementById('pfPlan');
const statusChip = document.getElementById('pfStatus');

const pfNombre    = document.getElementById('pfNombre');
const pfApellidos = document.getElementById('pfApellidos');
const pfCorreo    = document.getElementById('pfCorreo');
const pfCedula    = document.getElementById('pfCedula');   // NUEVO
const pfMembresia = document.getElementById('pfMembresia');
const pfEstado    = document.getElementById('pfEstado');
const pfExpira    = document.getElementById('pfExpira');

const editBtn     = document.getElementById('pfEdit');
const editForm    = document.getElementById('editForm');
const efNombre    = document.getElementById('efNombre');
const efApellidos = document.getElementById('efApellidos');
const efCedula    = document.getElementById('efCedula');   // NUEVO
const efCancel    = document.getElementById('efCancel');

let CURRENT_UID = null;

// Carga de perfil
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = './index.html'; return; }
  CURRENT_UID = user.uid;

  const ref = doc(db, 'users', CURRENT_UID);
  const snap = await getDoc(ref);
  const u = snap.exists() ? snap.data() : {};

  // Datos base
  const nombre    = u.nombre || user.displayName?.split(' ')?.[0] || '—';
  const apellidos = u.apellidos || user.displayName?.split(' ')?.slice(1).join(' ') || '—';
  const correo    = u.correo || user.email || '—';
  const plan      = u.membresia || u.membershipType || 'General';
  const expiry    = u.expiryDate || '—';
  const cedula    = u.cedula || '—';
  const state     = computeState(u);

  // Header
  avatarEl.textContent  = initialsFrom(nombre, apellidos);
  displayEl.textContent = `${nombre} ${apellidos}`.trim();
  emailChip.textContent = correo;

  planChip.textContent   = plan;
  planChip.className     = 'tag info';

  statusChip.textContent = state.label;
  statusChip.className   = `tag ${state.cls}`;

  // Grid
  pfNombre.textContent     = nombre;
  pfApellidos.textContent  = apellidos;
  pfCorreo.textContent     = correo;
  pfCedula.textContent     = cedula;           // NUEVO
  pfMembresia.textContent  = plan;
  pfEstado.textContent     = state.label;
  pfExpira.textContent     = formatDate(expiry);

  // Prefill edición
  efNombre.value    = (nombre === '—') ? '' : nombre;
  efApellidos.value = (apellidos === '—') ? '' : apellidos;
  efCedula.value    = (cedula === '—') ? '' : cedula; // NUEVO
});

// Toggle edición
editBtn?.addEventListener('click', ()=> {
  editForm.hidden = !editForm.hidden;
  if (!editForm.hidden) efNombre.focus();
});
efCancel?.addEventListener('click', ()=> { editForm.hidden = true; });

// Guardar edición
editForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre    = efNombre.value.trim();
  const apellidos = efApellidos.value.trim();
  const rawCedula = efCedula.value.trim();

  if (!nombre) { showAlert('El nombre es obligatorio','error'); return; }

  // Normaliza/valida cédula (opcional)
  let cedulaToSave = '';
  if (rawCedula) {
    const norm = normalizeCedula(rawCedula);
    if (norm === null) {
      showAlert('La cédula debe tener entre 8 y 20 dígitos (solo números).', 'error');
      return;
    }
    cedulaToSave = norm;
  }

  try {
    const ref = doc(db, 'users', CURRENT_UID);

    // Crea/actualiza nombre, apellidos y cédula
    const payload = { nombre, apellidos };
    if (cedulaToSave) payload.cedula = cedulaToSave;
    else payload.cedula = ''; // si quieres permitir borrado, mantenlo; si no, omite esta línea

    await setDoc(ref, payload, { merge: true });

    // Actualiza displayName de Auth (opcional)
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: `${nombre} ${apellidos}`.trim() });
    }

    // Refleja en UI
    avatarEl.textContent    = initialsFrom(nombre, apellidos);
    displayEl.textContent   = `${nombre} ${apellidos}`.trim();
    pfNombre.textContent    = nombre;
    pfApellidos.textContent = apellidos || '—';
    pfCedula.textContent    = cedulaToSave || '—';

    showAlert('Perfil actualizado','success');
    editForm.hidden = true;
  } catch (err) {
    console.error(err);
    showAlert('No se pudo actualizar el perfil','error');
  }
});
