// ./js/role-guard.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Activa logs si necesitas diagnosticar
const DEBUG = false;
const log = (...a) => { if (DEBUG) console.log('[ROLE-GUARD]', ...a); };

// ───────────────── Cache de roles (sessionStorage) ─────────────────
const K = (uid)=>`roles:${uid}`;
const putCache = (uid, roles)=>{ try{ sessionStorage.setItem(K(uid), JSON.stringify(roles||[])); }catch{} };
const getCache = (uid)=>{ try{ const r=sessionStorage.getItem(K(uid)); return r?JSON.parse(r):null; }catch{ return null; } };

// Marca anti-loop para redirecciones
function safeRedirect(url){
  try { sessionStorage.setItem('__gate_redirected', '1'); } catch {}
  location.replace(url);
}

export function waitForUser(){
  return new Promise(resolve=>{
    const unsub = onAuthStateChanged(auth, u => { unsub(); log('waitForUser', u?.uid || null); resolve(u||null); });
  });
}

export async function getMyRoles(uid){
  if (!uid) return [];
  const cached = getCache(uid);
  if (cached) { log('roles cached', cached); return cached; }
  try{
    const s = await getDoc(doc(db,'users', uid));
    const roles = s.exists() ? (Array.isArray(s.data().roles) ? s.data().roles : []) : [];
    putCache(uid, roles);
    log('roles fetched', roles);
    return roles;
  }catch(e){
    log('roles error', e);
    return [];
  }
}

// ───────────────── Guards (compat con tus imports actuales) ─────────────────

/** Páginas SOLO ADMIN. Si no hay sesión -> index; si no es admin -> client-dashboard. */
export async function gateAdmin(opts={ onDeny:'client-dashboard.html' }){ return gateAdminPage(opts); }
export async function gateAdminPage({ onDeny='client-dashboard.html' } = {}){
  const u = await waitForUser();
  if (!u) { safeRedirect('index.html'); return false; }
  const roles = await getMyRoles(u.uid);
  if (roles.includes('admin')) return true;
  safeRedirect(onDeny);
  return false;
}

/** Páginas de STAFF (admin o professor). Si no hay sesión -> index; si no es staff -> client-dashboard. */
export async function gateStaff(opts={ onDeny:'client-dashboard.html' }){ return gateStaffPage(opts); }
export async function gateStaffPage({ onDeny='client-dashboard.html' } = {}){
  const u = await waitForUser();
  if (!u) { safeRedirect('index.html'); return false; }
  const roles = await getMyRoles(u.uid);
  if (roles.includes('admin') || roles.includes('professor')) return true;
  safeRedirect(onDeny);
  return false;
}

/** Decide adónde aterrizar después de login. */
export async function decideLanding(){
  const u = await waitForUser();
  if (!u) return 'index.html';
  const r = await getMyRoles(u.uid);
  return r.includes('admin') ? 'admin-dashboard.html' : 'client-dashboard.html';
}
