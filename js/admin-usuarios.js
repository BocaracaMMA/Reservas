// ./js/admin-usuarios.js — Usuarios con “Solicitudes de registro”
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupInactivityTimeout } from './auth-timeout.js';
import {
  collection, query, where, updateDoc, doc, getDocs, deleteDoc, addDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';
import { isOculto } from './visibility-rules.js';

await gateAdminPage();

/* ============================================================================
   Helpers navbar
============================================================================ */
const ready = (fn) =>
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once:true })
    : fn();

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
      setTimeout(()=> location.href='index.html', 900);
    } catch {
      showAlert('Error al cerrar sesión','error');
    }
  });
  a.dataset.bound = '1';
}

/* ============================================================================
   Estado UI
============================================================================ */
let usersCache   = []; // aprobados
let pendingCache = []; // pendientes

// refs aprobados
const $tbody   = () => document.querySelector("#usuarios-table tbody");
const $filter  = () => document.getElementById("filterState");
const $sort    = () => document.getElementById("sortBy");
const $search  = () => document.getElementById('searchText');
const $clear   = () => document.getElementById('clearSearch');

// refs pendientes
const $ptbody  = () => document.querySelector("#pending-table tbody");
const $ptotal  = () => document.getElementById('pendingTotal');
const $pempty  = () => document.getElementById('pendingEmpty');

const norm = s => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const debounce = (fn, ms=150) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

/* ============================================================================
   Modal de confirmación reutilizable (misma estética que el resto)
============================================================================ */
function openConfirmDialog({
  title,
  message,
  confirmText = 'Confirmar',
  cancelText  = 'Cancelar',
  confirmVariant = 'primary', // 'primary' (verde) | 'danger' (rojo)
  onConfirm
}) {
  // Cerrar cualquier modal anterior por si acaso
  document.querySelectorAll('.custom-modal').forEach(m => m.remove());

  const confirmCls = confirmVariant === 'danger' ? 'btn error' : 'btn';
  const cancelCls  = confirmVariant === 'danger' ? 'btn' : 'btn error';

  const m = document.createElement('div');
  m.className = 'custom-modal';
  m.innerHTML = `
    <div class="modal-content confirm-modal">
      ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
      <p class="modal-message">${message}</p>
      <div class="modal-actions">
        <button type="button" class="${confirmCls}" data-role="confirm">${confirmText}</button>
        <button type="button" class="${cancelCls}" data-role="cancel">${cancelText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  const confirmBtn = m.querySelector('[data-role="confirm"]');
  const cancelBtn  = m.querySelector('[data-role="cancel"]');

  const close = () => {
    m.remove();
    window.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    close();
  });

  m.addEventListener('click', (e) => {
    if (e.target === m) close();
  });

  confirmBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!onConfirm) { close(); return; }
    confirmBtn.disabled = true;
    try {
      await onConfirm();
    } finally {
      confirmBtn.disabled = false;
      close();
    }
  });

  window.addEventListener('keydown', onKey);
}

/* ============================================================================
   Paginación Usuarios
============================================================================ */
let USERS_PAGE = 1;
const USERS_PER_PAGE = 15;

function ensureUsersPager(){
  let cont = document.getElementById('users-pager');
  if (!cont){
    cont = document.createElement('div');
    cont.id = 'users-pager';
    cont.className = 'pager';
    document.querySelector('#usuarios-table')?.parentElement?.after(cont);
  }
  return cont;
}
function renderUsersPager(totalItems){
  const totalPages = Math.max(1, Math.ceil(totalItems / USERS_PER_PAGE));
  USERS_PAGE = Math.min(Math.max(1, USERS_PAGE), totalPages);
  const cont = ensureUsersPager();
  cont.innerHTML = `
    <button class="btn-pg" id="pg-prev" ${USERS_PAGE<=1?'disabled':''}>Anterior</button>
    <span class="count">Página ${USERS_PAGE} de ${totalPages}</span>
    <button class="btn-pg" id="pg-next" ${USERS_PAGE>=totalPages?'disabled':''}>Siguiente</button>
  `;
  cont.querySelector('#pg-prev')?.addEventListener('click', ()=>{ USERS_PAGE--; renderUsers(); });
  cont.querySelector('#pg-next')?.addEventListener('click', ()=>{ USERS_PAGE++; renderUsers(); });
}

/* ============================================================================
   Datos / helpers Firestore
============================================================================ */
async function generateUniqueCode() {
  const randomCode = () => Math.floor(1000 + Math.random() * 9000).toString();
  let code, exists = true;
  while (exists) {
    code = randomCode();
    const q = query(collection(db, 'users'), where('attendanceCode', '==', code));
    const snap = await getDocs(q);
    exists = !snap.empty;
  }
  return code;
}

/* ---- Pendientes (approved:false) ---- */
async function loadPending(){
  const q1 = query(collection(db,'users'), where('approved','==', false));
  const s1 = await getDocs(q1);
  pendingCache = s1.docs.map(d => ({ id:d.id, ...d.data() }));
  renderPending();
}

function renderPending(){
  const tbody = $ptbody(); if (!tbody) return;
  tbody.innerHTML = '';
  $ptotal().textContent = `${pendingCache.length} pendientes`;
  $pempty().style.display = pendingCache.length ? 'none' : 'block';

  pendingCache.forEach(u=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nombre ?? '—'}</td>
      <td>${u.correo ?? '—'}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn--approve" data-id="${u.id}" title="Aceptar">✔️</button>
          <br>
          <button class="btn btn--reject"  data-id="${u.id}" title="Rechazar">❌</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('.btn--approve').addEventListener('click', ()=> approveUser(u));
    tr.querySelector('.btn--reject').addEventListener('click',  ()=> rejectUser(u));
  });
}

/* Lógica real de aprobación (sin confirm) */
async function doApproveUser(u){
  try{
    const patch = { approved:true };
    if (!u.attendanceCode) patch.attendanceCode = await generateUniqueCode();
    if (!Array.isArray(u.roles) || !u.roles.length) patch.roles = ['student'];

    await updateDoc(doc(db,'users',u.id), patch);

    pendingCache = pendingCache.filter(x=>x.id!==u.id);
    usersCache.push({ ...u, ...patch });

    renderPending();
    renderUsers();
    showAlert('Usuario aprobado.','success');
  }catch(e){
    console.error(e);
    showAlert('No se pudo aprobar la solicitud.','error');
  }
}

/* Lógica real de rechazo (sin confirm) */
async function doRejectUser(u){
  try{
    // limpiar índices y reservas asociadas
    try{
      if (u.cedula) { await deleteDoc(doc(db,'cedula_index', String(u.cedula))); }
    }catch{}

    try{
      const rs = await getDocs(query(collection(db,'reservations'), where('userId','==',u.id)));
      await Promise.all(rs.docs.map(d => deleteDoc(doc(db,'reservations', d.id))));
    }catch{}

    await deleteDoc(doc(db,'users', u.id));

    try{
      await addDoc(collection(db,'audit_logs'), {
        type:   'registration_reject',
        uid:    u.id,
        correo: u.correo || null,
        at:     Date.now()
      });
    }catch{}

    pendingCache = pendingCache.filter(x=>x.id!==u.id);
    renderPending();
    showAlert('Solicitud rechazada y datos eliminados.','success');
  }catch(e){
    console.error(e);
    showAlert('No se pudo rechazar la solicitud.','error');
  }
}

/* Wrappers con modal bonito */
function approveUser(u){
  const name = u.nombre || u.correo || 'este usuario';
  openConfirmDialog({
    title: 'Aprobar solicitud',
    message: `¿Aprobar la solicitud de registro de <strong>${name}</strong>?`,
    confirmText: 'Aprobar',
    cancelText: 'Cancelar',
    confirmVariant: 'primary',
    onConfirm: () => doApproveUser(u)
  });
}

function rejectUser(u){
  const name = u.correo || u.nombre || 'este usuario';
  openConfirmDialog({
    title: 'Rechazar solicitud',
    message: `¿Eliminar la solicitud de <strong>${name}</strong>? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    confirmVariant: 'danger',
    onConfirm: () => doRejectUser(u)
  });
}

/* ---- Aprobados (excluye approved:false) ---- */
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  usersCache = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.approved !== false);
  renderUsers();
}

function renderUsers() {
  const tbody = $tbody(); if (!tbody) return;
  tbody.innerHTML = "";

  const state  = $filter()?.value || 'all';
  const order  = $sort()?.value   || 'az';
  const queryText = norm($search()?.value || '');
  const tokens    = queryText.split(/\s+/).filter(Boolean);

  let list = usersCache.filter(u => {
    const oculto = isOculto(u);
    if (state === 'ocultos') {
      if (!oculto) return false;
    } else {
      if (oculto) return false;
      if (state === 'auth'   && !u.autorizado) return false;
      if (state === 'noauth' &&  u.autorizado) return false;
    }
    if (tokens.length) {
      const hay = norm(`${u.nombre||''} ${u.correo||''} ${u.attendanceCode||''}`);
      if (!tokens.every(t => hay.includes(t))) return false;
    }
    return true;
  });

  list.sort((a,b)=>{
    const an = norm(a.nombre), bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return order === 'za' ? -cmp : cmp;
  });

  renderUsersPager(list.length);
  const start = (USERS_PAGE-1) * USERS_PER_PAGE;
  list = list.slice(start, start + USERS_PER_PAGE);

  list.forEach(u => {
    const tr  = document.createElement("tr");
    tr.id     = `row-${u.id}`;
    tr.innerHTML = `
      <td>${u.nombre ?? ''}</td>
      <td>${u.correo ?? ''}</td>
      <td id="code-${u.id}">${u.attendanceCode || '—'}</td>
      <td>
        <div class="row-actions">
          <button class="btn code-btn" data-uid="${u.id}" title="Generar nuevo código">🎲</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Generar nuevo código
    tr.querySelector('.code-btn').addEventListener('click', async () => {
      try {
        const newCode = await generateUniqueCode();
        await updateDoc(doc(db, 'users', u.id), { attendanceCode: newCode });
        document.getElementById(`code-${u.id}`).textContent = newCode;
        u.attendanceCode = newCode;
        showAlert(`Código actualizado: ${newCode}`, "success");
      } catch (err) {
        console.error("Error generando attendanceCode:", err);
        showAlert("Error al generar el código.", "error");
      }
    });
  });

  document.getElementById('empty').style.display = list.length ? 'none' : 'block';
}

/* ============================================================================
   Init
============================================================================ */
function init(){
  bindSidebarOnce();
  bindLogoutOnce();
  setupInactivityTimeout?.();

  Promise.all([loadPending(), loadUsers()]).then(()=>{
    $filter()?.addEventListener('change', ()=>{ USERS_PAGE=1; renderUsers(); });
    $sort()?.addEventListener('change',   ()=>{ USERS_PAGE=1; renderUsers(); });

    const debounced = debounce(()=>{ USERS_PAGE=1; renderUsers(); }, 150);
    $search()?.addEventListener('input', () => {
      if ($clear()) $clear().style.display = ($search().value ? 'inline-flex' : 'none');
      debounced();
    });
    $clear()?.addEventListener('click', () => {
      if ($search()) $search().value = '';
      if ($clear())  $clear().style.display = 'none';
      USERS_PAGE=1; renderUsers();
    });
  });
}
ready(init);
