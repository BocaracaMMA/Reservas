// ./js/admin-roles.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';

// Gate único (sin loops)
await gateAdminPage();

// Admins fijos (blindados para edición)
const FIXED_ADMIN_UIDS = [
  "BTHOAu55O9QoAG1dB4eEgucXRet1",
  "JIA3ge7fFLMfrMH9Yyg6Av4OliI2"
];

let USERS = [];
let ME = null;
let myUid = null;

// ========== Navbar: hamburguesa + logout ==========
const toggleBtn = document.getElementById("toggleNav");
const sidebar   = document.getElementById("sidebar");
toggleBtn?.addEventListener("click", () => sidebar?.classList.toggle("active"));

document.getElementById("logoutSidebar")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    showAlert("Has cerrado sesión", "success");
    setTimeout(()=>location.href="index.html", 600);
  } catch {
    showAlert("Error al cerrar sesión", "error");
  }
});

// ========== Helpers ==========
const listEl  = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const totalEl = document.getElementById('total');

const fNombre = document.getElementById('fNombre');
const fCedula = document.getElementById('fCedula');
const fCorreo = document.getElementById('fCorreo');
const fFecha  = document.getElementById('fFecha');
const fRol    = document.getElementById('fRol');

function initialsFrom(name='', mail='') {
  if (name?.trim()) {
    return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('') || 'U';
  }
  return (mail[0]||'U').toUpperCase();
}
function hasRole(u, r){ return Array.isArray(u.roles) && u.roles.includes(r); }
function isFixed(uid){ return FIXED_ADMIN_UIDS.includes(uid); }
function iAmAdmin() {
  const roles = ME?.roles || [];
  return roles.includes('admin') || FIXED_ADMIN_UIDS.includes(myUid);
}

// ─── Paginación para tarjetas de roles ───
let ROLES_PAGE = 1;
const ROLES_PER_PAGE = 8;

function ensureRolesPager(){
  let cont = document.getElementById('roles-pager');
  if (!cont){
    cont = document.createElement('div');
    cont.id = 'roles-pager';
    cont.className = 'pager';
    listEl?.after(cont);
  }
  return cont;
}
function renderRolesPager(total){
  const totalPages = Math.max(1, Math.ceil(total / ROLES_PER_PAGE));
  ROLES_PAGE = Math.min(Math.max(1, ROLES_PAGE), totalPages);
  const cont = ensureRolesPager();
  cont.innerHTML = `
    <button class="btn-pg" id="pgr-prev" ${ROLES_PAGE<=1?'disabled':''}>Anterior</button>
    <span class="count">Página ${ROLES_PAGE} de ${totalPages}</span>
    <button class="btn-pg" id="pgr-next" ${ROLES_PAGE>=totalPages?'disabled':''}>Siguiente</button>
  `;
  cont.querySelector('#pgr-prev')?.addEventListener('click', ()=>{ ROLES_PAGE--; renderList(lastFilteredForPager); });
  cont.querySelector('#pgr-next')?.addEventListener('click', ()=>{ ROLES_PAGE++; renderList(lastFilteredForPager); });
}

let lastFilteredForPager = [];

// ========== Filtros ==========
function applyFilters() {
  const n = (fNombre?.value || '').toLowerCase().trim();
  const c = (fCedula?.value || '').trim();
  const e = (fCorreo?.value || '').toLowerCase().trim();
  const d = fFecha?.value || ''; // ISO yyyy-mm-dd
  const r = fRol?.value || '';   // rol seleccionado

  const filtered = USERS.filter(u => {
    if (n && !(`${u.nombre||''} ${u.apellidos||''}`.toLowerCase().includes(n))) return false;
    if (c && !(u.cedula||'').includes(c)) return false;
    if (e && !(u.correo||'').toLowerCase().includes(e)) return false;
    if (d && (u.createdAt||'') < d) return false;
    if (r && !hasRole(u,r)) return false;
    return true;
  });

  ROLES_PAGE = 1;          // reset al filtrar
  renderList(filtered);
}
[fNombre,fCedula,fCorreo,fFecha,fRol].forEach(el=>{
  el?.addEventListener('input', applyFilters);
  el?.addEventListener('change', applyFilters);
});

// ========== Render ==========
function renderList(items) {
  listEl.innerHTML = '';
  totalEl.textContent = `${items.length} usuario${items.length===1?'':'s'}`;
  if (!items.length) { 
    emptyEl.style.display='block'; 
    ensureRolesPager(); 
    renderRolesPager(0); 
    lastFilteredForPager = [];
    return; 
  }
  emptyEl.style.display='none';

  // paginar
  lastFilteredForPager = items.slice();
  renderRolesPager(lastFilteredForPager.length);
  const start = (ROLES_PAGE-1) * ROLES_PER_PAGE;
  items = items.slice(start, start + ROLES_PER_PAGE);

  const frag = document.createDocumentFragment();

  items.forEach(u => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.uid = u.uid;

    // fila 1
    const row1 = document.createElement('div');
    row1.className = 'row1';

    const identity = document.createElement('div');
    identity.className = 'user-id';
    identity.innerHTML = `
      <div class="avatar">${initialsFrom(`${u.nombre||''} ${u.apellidos||''}`, u.correo||'')}</div>
      <div class="name-mail">
        <div class="name">${u.nombre||'—'} ${u.apellidos||''}</div>
        <div class="mail">${u.correo||''}</div>
      </div>
    `;

    const badges = document.createElement('div');
    badges.className = 'badges';
    const mbs = document.createElement('span');
    mbs.className = 'badge ' + (u.autorizado ? 'green' : '');
    mbs.textContent = (u.autorizado ? 'Activa' : 'Inactiva');

    const rol = document.createElement('span');
    rol.className = 'badge';
    rol.textContent = (u.roles||[]).join(' , ') || 'sin rol';
    badges.append(mbs, rol);

    row1.append(identity, badges);

    // fila 2: chips + guardar
    const row2 = document.createElement('div');
    row2.style.display = 'grid';
    row2.style.gap = '10px';

    const rolesBox = document.createElement('div');
    rolesBox.className = 'roles';

    const roles = [
      {key:'admin',     icon:'shield-lock'},
      {key:'professor', icon:'mortarboard'},
      {key:'student',   icon:'person-check'}
    ];

    roles.forEach(r => {
      const span = document.createElement('span');
      span.className = 'chip' + (hasRole(u,r.key) ? ' active' : '');
      span.dataset.role = r.key;
      span.innerHTML = `<i class="bi bi-${r.icon}"></i> ${r.key}`;
      if (isFixed(u.uid) && myUid !== u.uid) span.classList.add('lock');
      span.addEventListener('click', () => {
        if (span.classList.contains('lock')) return;
        span.classList.toggle('active');
      });
      rolesBox.appendChild(span);
    });

    const actions = document.createElement('div');
    actions.className = 'actions';
    const save = document.createElement('button');
    save.className = 'btn save';
    save.textContent = 'Guardar roles';
    if (isFixed(u.uid) && myUid !== u.uid) save.disabled = true;

    save.addEventListener('click', async () => {
      if (!iAmAdmin()) { showAlert('No autorizado', 'error'); return; }
      const newRoles = Array.from(rolesBox.querySelectorAll('.chip.active')).map(x=>x.dataset.role);
      if (isFixed(u.uid) && myUid !== u.uid) return;
      if (!newRoles.length) { showAlert('Debe tener al menos un rol', 'error'); return; }
      try {
        await updateDoc(doc(db,'users',u.uid), { roles: newRoles });
        showAlert('Roles actualizados', 'success');
      } catch (err) {
        console.error(err);
        showAlert('No se pudieron actualizar los roles', 'error');
      }
    });

    actions.appendChild(save);
    row2.append(rolesBox, actions);

    // fila 3: info
    const row3 = document.createElement('div');
    row3.style.display = 'grid';
    row3.style.gap = '6px';
    row3.innerHTML = `
      <div class="badge">Cédula: ${u.cedula || '—'}</div>
      <div class="badge">Creado: ${u.createdAt || '—'}</div>
    `;

    card.append(row1, row2, row3);
    frag.appendChild(card);
  });

  listEl.appendChild(frag);
}

// ========== Auth / Carga ==========
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = 'index.html'; return; }
  myUid = user.uid;

  const meSnap = await getDoc(doc(db,'users', user.uid));
  ME = meSnap.exists() ? meSnap.data() : null;

  // Mostrar ítems "admin-only" del sidebar (si existen en tu HTML)
  document.querySelectorAll('.sidebar .admin-only').forEach(li => li.style.display = 'list-item');

  // Listado en tiempo real
  onSnapshot(collection(db,'users'), (snap) => {
    USERS = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    USERS.forEach(u => { if (!u.createdAt) u.createdAt = ''; });
    applyFilters();
  }, (err) => {
    console.error(err);
    showAlert('Error cargando usuarios', 'error');
  });
});

// === Select de roles mejorado v2 (sin desbordes ni bullets) ===
(function enhanceRoleSelect(){
  const sel = document.getElementById('fRol');
  if (!sel || sel.dataset.enhanced) return;

  const container = sel.closest('.f');
  container.classList.add('selectx');

  sel.classList.add('selectx-native');
  sel.dataset.enhanced = '1';

  const display = document.createElement('button');
  display.type = 'button';
  display.className = 'selectx-display';
  display.innerHTML = `
    <span class="label">${sel.options[sel.selectedIndex]?.text || 'Rol (todos)'}</span>
    <i class="bi bi-chevron-down chev" aria-hidden="true"></i>
  `;

  const list = document.createElement('ul');
  list.className = 'selectx-list';
  list.setAttribute('role','listbox');

  // Construye opciones
  [...sel.options].forEach(opt => {
    const li = document.createElement('li');
    li.className = 'item';
    li.textContent = opt.text;
    li.dataset.value = opt.value;
    li.setAttribute('role','option');
    if (opt.selected) li.setAttribute('aria-selected','true');
    li.addEventListener('click', () => {
      // UI
      list.querySelectorAll('.item[aria-selected="true"]').forEach(x=>x.removeAttribute('aria-selected'));
      li.setAttribute('aria-selected','true');
      display.querySelector('.label').textContent = opt.text;

      // Select real + filtros
      sel.value = li.dataset.value;
      sel.dispatchEvent(new Event('change', { bubbles:true }));

      container.classList.remove('open','dropup');
    });
    list.appendChild(li);
  });

  // Abre/cierra y decide drop-up si no hay espacio
  function positionPanel(){
    // resetea estado
    container.classList.remove('dropup');
    const rect = container.getBoundingClientRect();
    const panelHeight = Math.min(list.scrollHeight, 260);
    const spaceBelow = window.innerHeight - rect.bottom - 12; // 12px colchón
    const spaceAbove = rect.top - 12;

    if (spaceBelow < panelHeight && spaceAbove > panelHeight){
      container.classList.add('dropup'); // abre hacia arriba cuando conviene
    }
  }

  display.addEventListener('click', () => {
    const isOpen = container.classList.toggle('open');
    if (isOpen) positionPanel();
  });

  // Cerrar al click fuera o ESC
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) container.classList.remove('open','dropup');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') container.classList.remove('open','dropup');
  });

  // Refleja cambios externos al <select>
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex];
    display.querySelector('.label').textContent = opt?.text || 'Rol (todos)';
    list.querySelectorAll('.item').forEach(li=>{
      li.toggleAttribute('aria-selected', li.dataset.value === sel.value);
    });
  });

  // Monta
  container.append(display, list);

  // Recolocar si cambia el viewport (rotación / resize)
  window.addEventListener('resize', () => {
    if (container.classList.contains('open')) positionPanel();
  });
})();
