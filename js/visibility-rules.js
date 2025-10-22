// ./js/visibility-rules.js
import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/** Días sin actividad para ocultar */
export const HIDE_AFTER_DAYS = 90;
const HIDE_AFTER_MS = HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000;

/** Parsea 'YYYY-MM-DD' a ms (fin del día, tolerante) */
function parseISODateEndOfDayMs(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, (m - 1), d, 23, 59, 59, 999);
}

/** Máximo entre: expiryDate (string), lastPaymentAt (TS), lastLoginAt (TS) */
function getLastActivityMs(user) {
  const expiryMs = parseISODateEndOfDayMs(user?.expiryDate);
  const lastPayMs = user?.lastPaymentAt?.toMillis?.() ?? null;
  const lastLoginMs = user?.lastLoginAt?.toMillis?.() ?? null;
  const vals = [expiryMs, lastPayMs, lastLoginMs].filter(n => typeof n === 'number');
  if (!vals.length) return null;
  return Math.max(...vals);
}

/** Regla de oculto: hoy - últimaActividad > 90 días */
export function isOculto(user) {
  const last = getLastActivityMs(user);
  if (last == null) return false; // sin datos = visible
  return (Date.now() - last) > HIDE_AFTER_MS;
}

/** Estado derivado simple (por si lo quieres mostrar) */
export function computeEstado(user) {
  if (isOculto(user)) return 'oculto';
  const expMs = parseISODateEndOfDayMs(user?.expiryDate);
  if (expMs == null) return 'inactivo';
  return expMs >= Date.now() ? 'activo' : 'inactivo';
}

/** Visibilidad según filtro */
export function shouldShowUser(user, filtro = 'todos') {
  const estado = computeEstado(user);
  switch (filtro) {
    case 'ocultos':   return estado === 'oculto';
    case 'activos':   return estado === 'activo';
    case 'inactivos': return estado === 'inactivo';
    case 'todos':
    default:          return estado === 'activo' || estado === 'inactivo';
  }
}

/** Al iniciar sesión, “reactiva” (vuelve visible) */
export async function markLoginActivity(uid) {
  if (!uid) return;
  await setDoc(doc(db, 'users', uid), { lastLoginAt: serverTimestamp() }, { merge: true });
}
