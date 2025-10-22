// ./js/admin-mensualidades.js
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';
import { isOculto } from './visibility-rules.js';

// ===== helpers de init/DOM seguros =====
const ready = (fn) =>
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once:true })
    : fn();

function ensureNavCSS(){
  if (document.getElementById('nav-fallback-css')) return;
  const style = document.createElement('style');
  style.id = 'nav-fallback-css';
  style.textContent = `
    .hamburger-btn{position:fixed;right:16px;top:16px;z-index:10001}
    .sidebar{position:fixed;inset:0 auto 0 0;width:260px;height:100vh;
             transform:translateX(-100%);transition:transform .25s ease;z-index:10000}
    .sidebar.active{transform:translateX(0)}
  `;
  document.head.appendChild(style);
}
function bindSidebarOnce(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (!btn || !sb || btn.dataset.bound) return;
  btn.addEventListener('click', ()=> sb.classList.toggle('active'));
  btn.dataset.bound = '1';
}
function bindLogoutOnce(){
  const a = document.getElementById('logoutSidebar');
  if (!a || a.dataset.bound) return;
  a.addEventListener('click', async (e)=>{
    e.preventDefault();
    try {
      await signOut(auth);
      showAlert('Sesión cerrada','success');
      setTimeout(()=>location.href='index.html', 900);
    } catch {
      showAlert('Error al cerrar sesión','error');
    }
  });
  a.dataset.bound = '1';
}

// ===== estado UI =====
let usersCache = [];
const $tbody   = () => document.querySelector('#mensualidades-table tbody');
const $filter  = () => document.getElementById('filterState'); // activo | proxima | vencida | all | ocultos
const $sort    = () => document.getElementById('sortBy');
const $search  = () => document.getElementById('searchText');
const $clear   = () => document.getElementById('clearSearch');

const norm = s => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const debounce = (fn, ms=180) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

// ===== fechas/estados (vista de mensualidades) =====
function todayCRDate(){ return new Date(new Date().toLocaleString('en-US', { timeZone:'America/Costa_Rica' })); }
function daysUntil(expiryDateStr){
  if (!expiryDateStr) return -9999;
  const [y,m,d] = expiryDateStr.split('-').map(Number);
  const expiry = new Date(y, m-1, d, 23,59,59);
  return Math.floor((expiry - todayCRDate())/86400000);
}
function getMembershipState(u){
  if (!u.autorizado) return 'Vencida';
  const exp = u.expiryDate;
  if (!exp) return 'Vencida';
  const left = daysUntil(exp);
  if (left < 0) return 'Vencida';
  if (left <= 5) return 'Próxima a vencer';
  return 'Activo';
}
function stateToClass(s){
  if (s==='Vencida') return 'state-vencida';
  if (s==='Próxima a vencer') return 'state-proxima';
  if (s==='Activo') return 'state-activo';
  return '';
}

// ─── Paginación Mensualidades ───
let MENS_PAGE = 1;
const MENS_PER_PAGE = 15;

function ensureMensPager(){
  let cont = document.getElementById('mensu-pager');
  if (!cont){
    cont = document.createElement('div');
    cont.id = 'mensu-pager';
    cont.className = 'pager';
    document.querySelector('#mensualidades-table')?.parentElement?.after(cont);
  }
  return cont;
}
function renderMensPager(total){
  const totalPages = Math.max(1, Math.ceil(total / MENS_PER_PAGE));
  MENS_PAGE = Math.min(Math.max(1, MENS_PAGE), totalPages);
  const cont = ensureMensPager();
  cont.innerHTML = `
    <button class="btn-pg" id="pgm-prev" ${MENS_PAGE<=1?'disabled':''}>Anterior</button>
    <span class="count">Página ${MENS_PAGE} de ${totalPages}</span>
    <button class="btn-pg" id="pgm-next" ${MENS_PAGE>=totalPages?'disabled':''}>Siguiente</button>
  `;
  cont.querySelector('#pgm-prev')?.addEventListener('click', ()=>{ MENS_PAGE--; renderMensualidades(); });
  cont.querySelector('#pgm-next')?.addEventListener('click', ()=>{ MENS_PAGE++; renderMensualidades(); });
}

// ===== datos + render =====
async function loadMensualidades(){
  try {
    const snap = await getDocs(collection(db,'users'));
    usersCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderMensualidades();
  } catch (e) {
    console.error('Error cargando mensualidades:', e);
    showAlert('No se pudieron cargar los datos','error');
  }
}

function renderMensualidades(){
  const tbody = $tbody(); if (!tbody) return;
  tbody.innerHTML = '';

  const stateFilter = $filter()?.value || 'all';
  const order       = $sort()?.value   || 'az';
  const queryText   = norm($search()?.value || '');
  const tokens      = queryText.split(/\s+/).filter(Boolean);

  let list = usersCache
    .map(u => ({ ...u, __state: getMembershipState(u) }))
    .filter(u => {
      // Ocultos
      const oculto = isOculto(u);
      if (stateFilter === 'ocultos') { if (!oculto) return false; }
      else { if (oculto) return false; }

      // Estado
      if (stateFilter==='activo'  && u.__state!=='Activo') return false;
      if (stateFilter==='proxima' && u.__state!=='Próxima a vencer') return false;
      if (stateFilter==='vencida' && u.__state!=='Vencida') return false;

      // Búsqueda
      if (!tokens.length) return true;
      const hay = norm(`${u.nombre||''} ${u.correo||''} ${u.cedula||''}`);
      return tokens.every(t => hay.includes(t));
    });

  // ordenar
  list.sort((a,b)=>{
    const an = norm(a.nombre), bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return (order==='za') ? -cmp : cmp;
  });

  // paginar
  renderMensPager(list.length);
  const start = (MENS_PAGE-1) * MENS_PER_PAGE;
  list = list.slice(start, start + MENS_PER_PAGE);

  const frag = document.createDocumentFragment();
  list.forEach(u=>{
    const uid=u.id, exp=u.expiryDate||'—', st=u.__state, cls=stateToClass(st);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nombre||''}</td>
      <td>${u.correo||''}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado?'checked':''} data-uid="${uid}">
          <span class="slider round"></span>
        </label>
      </td>
      <td>${exp}</td>
      <td><span class="${cls}">${st}</span></td>
      <td><input type="month" id="month-${uid}" value="${exp==='—'?'':exp.slice(0,7)}"></td>
      <td><button class="btnPay btn" data-uid="${uid}">Guardar</button></td>
    `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  // delegación (toggle + guardar pago)
  tbody.onclick = async (e)=>{
    const t = e.target;

    if (t.matches('input[type="checkbox"][data-uid]')){
      const uid = t.getAttribute('data-uid');
      const checked = t.checked;
      try {
        await updateDoc(doc(db,'users',uid), { autorizado: checked });
        showAlert('Autorización actualizada','success');
        await loadMensualidades();
      } catch {
        showAlert('Error al actualizar','error');
        t.checked = !checked;
      }
    }

    if (t.matches('.btnPay[data-uid]')){
      const uid = t.getAttribute('data-uid');
      const monthVal = document.getElementById(`month-${uid}`)?.value || '';
      if (!monthVal){ showAlert('Selecciona un mes','error'); return; }
      const [y,m] = monthVal.split('-').map(Number);
      const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
      try {
        await updateDoc(doc(db,'users',uid), {
          expiryDate: lastDay,
          autorizado: true,
          lastPaymentAt: serverTimestamp()
        });
        showAlert('Pago registrado','success');
        await loadMensualidades();
      } catch { showAlert('Error al guardar pago','error'); }
    }
  };
}

// ===== init protegido por roles (no bloquea el shell) =====
async function initProtected(){
  if (window.lucide) { try { window.lucide.createIcons(); } catch {} }
  await loadMensualidades();

  // filtros
  $filter()?.addEventListener('change', ()=>{ MENS_PAGE=1; renderMensualidades(); });
  $sort()?.addEventListener('change',   ()=>{ MENS_PAGE=1; renderMensualidades(); });

  // búsqueda con debounce + limpiar
  const debounced = debounce(()=>{ MENS_PAGE=1; renderMensualidades(); }, 150);
  $search()?.addEventListener('input', () => {
    if ($clear()) $clear().style.display = ($search().value ? 'inline-flex' : 'none');
    debounced();
  });
  $clear()?.addEventListener('click', () => {
    if ($search()){ $search().value = ''; }
    if ($clear()) $clear().style.display = 'none';
    MENS_PAGE=1; renderMensualidades();
  });
}

// Monta el shell siempre, valida roles en paralelo
ready(() => {
  ensureNavCSS();
  bindSidebarOnce();
  bindLogoutOnce();
  gateAdminPage()
    .then(initProtected)
    .catch(() => {/* role-guard redirige si no es admin */});
});
