// ./js/profile.js  (parche: cédula no editable + update parcial)
import { auth, db } from './firebase-config.js';
import {
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ───────────────── Sidebar ───────────────── */
(function setupSidebarToggle(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (btn && sb) btn.addEventListener('click', ()=> sb.classList.toggle('active'));
})();

/* ───────────────── Logout ───────────────── */
const logoutBtn = document.getElementById('logoutSidebar');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await signOut(auth); showAlert('Sesión cerrada','success'); }
    catch { showAlert('Error al cerrar sesión','error'); }
    finally { setTimeout(()=> location.href='index.html', 800); }
  });
}

/* ───────────────── Utilidades ───────────────── */
function crToday() {
  return new Date(new Date().toLocaleString('en-US',{ timeZone:'America/Costa_Rica'}));
}
function daysUntil(dateStr){
  if (!dateStr) return -9999;
  const [y,m,d] = dateStr.split('-').map(Number);
  const target  = new Date(y, m-1, d);
  return Math.floor( (target - crToday()) / (1000*60*60*24) );
}
function computeState(u) {
  if (!u?.autorizado) return { label:'Vencida', cls:'error' };
  const left = daysUntil(u?.expiryDate);
  if (left < 0)  return { label:'Vencida', cls:'error' };
  if (left <= 5) return { label:'Por Vencer', cls:'warn' };
  return { label:'Activa', cls:'success' };
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y,m,d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('es-CR',
      { year:'numeric', month:'long', day:'2-digit' });
  } catch { return dateStr; }
}

/* ───────────────── Referencias UI ───────────────── */
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
const efCelular     = document.getElementById('efCelular');          // opcional si existe en tu HTML
const efCorreo      = document.getElementById('efCorreo');           // opcional si existe en tu HTML
const efGenero      = document.getElementById('efGenero');
const efNacimiento  = document.getElementById('efNacimiento');

const efCedula      = document.getElementById('efCedula');           // ← si existen, se deshabilitan
const efCedulaTipo  = document.getElementById('efCedulaTipo');
const efCedulaExt   = document.getElementById('efCedulaExtranjera');

const efCancel      = document.getElementById('efCancel');

let CURRENT_UID = null;
let ORIGINAL = {};   // valores originales para detectar cambios

/* ───────────────── Carga de perfil ───────────────── */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = './index.html'; return; }
  CURRENT_UID = user.uid;

  const ref = doc(db, 'users', CURRENT_UID);
  const snap = await getDoc(ref);
  const u = snap.exists() ? snap.data() : {};

  // Datos base
  const nombre    = u.nombre || '—';
  const apellidos = u.apellidos || '—';
  const correo    = u.correo || user.email || '—';
  const plan      = u.membresia || u.membershipType || 'General';
  const expiry    = u.expiryDate || '—';
  const state     = computeState(u);

  // Cédulas/IDs (solo display)
  const cedulaTipo = u.cedulaTipo || (u.cedula ? 'nacional' : (u.cedulaExtranjera ? 'extranjera':''));
  const cedula     = u.cedula || u.cedulaExtranjera || '—';

  // Header
  displayEl && (displayEl.textContent = `${nombre} ${apellidos}`.trim());
  emailChip && (emailChip.textContent = correo);

  planChip && (planChip.textContent = plan, planChip.className = 'tag info');
  statusChip && (statusChip.textContent = state.label, statusChip.className = `tag ${state.cls}`);

  // Grid (visual)
  pfNombre     && (pfNombre.textContent    = nombre);
  pfApellidos  && (pfApellidos.textContent = apellidos);
  pfCorreo     && (pfCorreo.textContent    = correo);
  pfCedula     && (pfCedula.textContent    = cedula);
  pfMembresia  && (pfMembresia.textContent = plan);
  pfEstado     && (pfEstado.textContent    = state.label);
  pfExpira     && (pfExpira.textContent    = formatDate(expiry));
  pfGenero     && (pfGenero.textContent    =
    (u.genero || u.gender)
      ? ({masculino:'Masculino', femenino:'Femenino', no_binario:'No binario', prefiero_no_decir:'Prefiero no decir', otro:'Otro', no_especificado:'Prefiero no decir'}[(u.genero||u.gender)] || '—')
      : '—'
  );
  pfNacimiento && (pfNacimiento.textContent = u.birthDate ? formatDate(u.birthDate) : '—');

  // Prefill edición
  efNombre      && (efNombre.value      = nombre === '—' ? '' : nombre);
  efApellidos   && (efApellidos.value   = apellidos === '—' ? '' : apellidos);
  efCelular     && (efCelular.value     = u.celular || '');
  efCorreo      && (efCorreo.value      = correo === '—' ? '' : correo);
  efGenero      && (efGenero.value      = (u.genero || u.gender || 'no_especificado'));
  efNacimiento  && (efNacimiento.value  = u.birthDate || '');

  // CÉDULA: deshabilitar edición si los inputs existen en el HTML
  [efCedula, efCedulaTipo, efCedulaExt].forEach(el => {
    if (el) {
      el.value = el.id === 'efCedulaTipo'
        ? (cedulaTipo || '')
        : (cedula === '—' ? '' : cedula);
      el.setAttribute('disabled','true');
      el.classList.add('is-readonly'); // por si quieres estilizar en CSS
    }
  });

  // Guarda originales para diff
  ORIGINAL = {
    nombre: efNombre ? efNombre.value : '',
    apellidos: efApellidos ? efApellidos.value : '',
    celular: efCelular ? efCelular.value : undefined,
    correo: efCorreo ? efCorreo.value : undefined,
    genero: efGenero ? efGenero.value : undefined,
    birthDate: efNacimiento ? efNacimiento.value : undefined,
  };
});

/* ───────────────── Toggle edición ───────────────── */
editBtn?.addEventListener('click', ()=> {
  if (!editForm) return;
  editForm.hidden = !editForm.hidden;
  if (!editForm.hidden) efNombre?.focus();
});
efCancel?.addEventListener('click', ()=> { if (editForm) editForm.hidden = true; });

/* ───────────────── Guardar edición (parcial) ───────────────── */
editForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!CURRENT_UID) return;

  // Toma valores actuales
  const vNombre     = efNombre ? efNombre.value.trim()     : undefined;
  const vApellidos  = efApellidos ? efApellidos.value.trim(): undefined;
  const vCelular    = efCelular ? efCelular.value.trim()    : undefined;
  const vCorreo     = efCorreo ? efCorreo.value.trim()      : undefined;
  const vGenero     = efGenero ? efGenero.value             : undefined;
  const vBirthDate  = efNacimiento ? efNacimiento.value     : undefined;

  // Construye payload SOLO con cambios y **sin** cédula/cédulaTipo/cédulaExtranjera
  const payload = {};
  const putIfChanged = (key, val) => {
    if (typeof val === 'undefined') return;
    const before = (ORIGINAL[key] ?? '');
    if (val !== before) payload[key] = val;  // permite vacío
  };

  putIfChanged('nombre', vNombre);
  putIfChanged('apellidos', vApellidos);
  putIfChanged('celular', vCelular);
  putIfChanged('correo', vCorreo);
  // En tu base algunas veces está 'genero' y otras 'gender'; usa 'genero' de forma canónica
  if (typeof vGenero !== 'undefined' && vGenero !== ORIGINAL.genero) payload.genero = vGenero;
  putIfChanged('birthDate', vBirthDate);

  // Nunca enviar campos de cédula en updates desde perfil
  // (si existen inputs, están deshabilitados y además los ignoramos aquí)
  // payload.cedula, payload.cedulaTipo, payload.cedulaExtranjera → INTENCIONALMENTE NO

  if (!Object.keys(payload).length) {
    showAlert('No hay cambios por guardar.', 'success');
    editForm.hidden = true;
    return;
  }

  try {
    const ref = doc(db, 'users', CURRENT_UID);
    console.log('[profile] setDoc users/%s (merge) payload:', CURRENT_UID, payload);
    await setDoc(ref, payload, { merge: true });

    // Actualiza displayName si cambió
    if ((payload.nombre || payload.apellidos) && auth.currentUser) {
      const n = payload.nombre ?? ORIGINAL.nombre ?? '';
      const a = payload.apellidos ?? ORIGINAL.apellidos ?? '';
      try { await updateProfile(auth.currentUser, { displayName: `${n} ${a}`.trim() }); } catch {}
    }

    // Refleja en UI
    if ('nombre' in payload)    pfNombre    && (pfNombre.textContent = payload.nombre || '—');
    if ('apellidos' in payload) pfApellidos && (pfApellidos.textContent = payload.apellidos || '—');
    if ('correo' in payload)    pfCorreo    && (pfCorreo.textContent = payload.correo || '—');
    if ('genero' in payload)    pfGenero    && (pfGenero.textContent =
      payload.genero ? ({masculino:'Masculino', femenino:'Femenino', no_binario:'No binario', prefiero_no_decir:'Prefiero no decir', otro:'Otro', no_especificado:'Prefiero no decir'}[payload.genero] || '—') : '—'
    );
    if ('birthDate' in payload) pfNacimiento && (pfNacimiento.textContent = payload.birthDate ? formatDate(payload.birthDate) : '—');

    // Actualiza ORIGINAL con lo nuevo
    ORIGINAL = { ...ORIGINAL, ...payload };

    showAlert('Perfil actualizado','success');
    editForm.hidden = true;

  } catch (err) {
    console.error('[profile] Firestore error:', err);
    // Sugerencia útil para reglas
    if (err?.code === 'permission-denied') {
      showAlert('Permisos insuficientes para guardar el perfil. Revisa reglas o campos sensibles.', 'error');
    } else {
      showAlert('No se pudo actualizar el perfil.', 'error');
    }
  }
});
