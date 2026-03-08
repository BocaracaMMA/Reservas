// ./js/admin-mensualidades.js
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';
import { isOculto } from './visibility-rules.js';

const ready = (fn) =>
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

function ensureNavCSS() {
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

function bindSidebarOnce() {
  const btn = document.getElementById('toggleNav');
  const sb = document.getElementById('sidebar');
  if (!btn || !sb || btn.dataset.bound) return;

  btn.addEventListener('click', () => sb.classList.toggle('active'));
  btn.dataset.bound = '1';
}

function bindLogoutOnce() {
  const a = document.getElementById('logoutSidebar');
  if (!a || a.dataset.bound) return;

  a.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      showAlert('Sesión cerrada', 'success');
      setTimeout(() => location.href = 'index.html', 900);
    } catch {
      showAlert('Error al cerrar sesión', 'error');
    }
  });

  a.dataset.bound = '1';
}

let usersCache = [];

const $tbody = () => document.querySelector('#mensualidades-table tbody');
const $filter = () => document.getElementById('filterState');
const $sort = () => document.getElementById('sortBy');
const $search = () => document.getElementById('searchText');
const $clear = () => document.getElementById('clearSearch');

const norm = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const debounce = (fn, ms = 180) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

/**
 * Fecha actual en zona horaria de Costa Rica.
 */
function todayCRDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
}

/**
 * Días restantes hasta expiryDate.
 */
function daysUntil(expiryDateStr) {
  if (!expiryDateStr) return -9999;

  const [y, m, d] = expiryDateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d, 23, 59, 59);
  return Math.floor((expiry - todayCRDate()) / 86400000);
}

/**
 * Estado visual de la membresía.
 */
function getMembershipState(user) {
  if (!user.autorizado) return 'Vencida';

  const exp = user.expiryDate;
  if (!exp) return 'Vencida';

  const left = daysUntil(exp);
  if (left < 0) return 'Vencida';
  if (left <= 5) return 'Próxima a vencer';
  return 'Activo';
}

function stateToClass(state) {
  if (state === 'Vencida') return 'state-vencida';
  if (state === 'Próxima a vencer') return 'state-proxima';
  if (state === 'Activo') return 'state-activo';
  return '';
}

function getCRYearMonth() {
  const now = todayCRDate();
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}

function currentYearMonthStr() {
  const { y, m } = getCRYearMonth();
  return `${y}-${String(m).padStart(2, '0')}`;
}

function isCurrentMonth(ym) {
  const { y, m } = getCRYearMonth();
  if (!ym) return false;

  const [yy, mm] = ym.split('-').map(Number);
  return yy === y && mm === m;
}

function isNextMonth(ym) {
  const { y, m } = getCRYearMonth();
  if (!ym) return false;

  const [yy, mm] = ym.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return yy === nextY && mm === nextM;
}

/**
 * Último día del mes YYYY-MM.
 */
function lastDayOfMonth(ym) {
  if (!ym) return '';

  const [yy, mm] = ym.split('-').map(Number);
  const last = new Date(yy, mm, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const d = String(last.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let MENS_PAGE = 1;
const MENS_PER_PAGE = 15;

function ensureMensPager() {
  let cont = document.getElementById('mensu-pager');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'mensu-pager';
    cont.className = 'pager';
    document.querySelector('#mensualidades-table')?.parentElement?.after(cont);
  }
  return cont;
}

function renderMensPager(total) {
  const totalPages = Math.max(1, Math.ceil(total / MENS_PER_PAGE));
  MENS_PAGE = Math.min(Math.max(1, MENS_PAGE), totalPages);

  const cont = ensureMensPager();
  cont.innerHTML = `
    <button class="btn-pg" id="pgm-prev" ${MENS_PAGE <= 1 ? 'disabled' : ''}>Anterior</button>
    <span class="count">Página ${MENS_PAGE} de ${totalPages}</span>
    <button class="btn-pg" id="pgm-next" ${MENS_PAGE >= totalPages ? 'disabled' : ''}>Siguiente</button>
  `;

  cont.querySelector('#pgm-prev')?.addEventListener('click', () => {
    MENS_PAGE--;
    renderMensualidades();
  });

  cont.querySelector('#pgm-next')?.addEventListener('click', () => {
    MENS_PAGE++;
    renderMensualidades();
  });
}

async function loadMensualidades() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const changed = await enforceAuthByExpiry(usersCache);
    if (changed) {
      const snap2 = await getDocs(collection(db, 'users'));
      usersCache = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    renderMensualidades();
  } catch (e) {
    console.error('Error cargando mensualidades:', e);
    showAlert('No se pudieron cargar los datos', 'error');
  }
}

/**
 * Desautoriza automáticamente usuarios vencidos.
 */
async function enforceAuthByExpiry(list) {
  const updates = [];
  const now = todayCRDate();

  for (const user of list) {
    if (!user?.expiryDate) continue;

    const [y, m, d] = user.expiryDate.split('-').map(Number);
    const exp = new Date(y, m - 1, d, 23, 59, 59);

    if (exp < now && user.autorizado === true) {
      updates.push(
        updateDoc(doc(db, 'users', user.id), {
          autorizado: false,
          autoRevokedAt: serverTimestamp()
        })
      );
    }
  }

  if (!updates.length) return false;

  await Promise.allSettled(updates);
  return true;
}

/**
 * Registra pago de mensualidad.
 * Autoriza solo si se selecciona mes actual o próximo.
 */
async function handleSavePayment(uid) {
  const monthVal = document.getElementById(`month-${uid}`)?.value || '';
  if (!monthVal) {
    showAlert('Selecciona un mes', 'error');
    return;
  }

  const expiryStr = lastDayOfMonth(monthVal);
  const shouldAuthorize = isCurrentMonth(monthVal) || isNextMonth(monthVal);

  try {
    await updateDoc(doc(db, 'users', uid), {
      expiryDate: expiryStr,
      autorizado: shouldAuthorize,
      lastPaymentAt: serverTimestamp(),
      cancelledAt: null
    });

    showAlert(
      shouldAuthorize
        ? 'Pago registrado y reservas autorizadas.'
        : 'Pago registrado. Reservas no autorizadas: seleccione mes actual o próximo.',
      'success'
    );

    await loadMensualidades();
  } catch (error) {
    console.error('Error al guardar pago:', error);
    showAlert('Error al guardar pago', 'error');
  }
}

/**
 * Anula la mensualidad del usuario seleccionado.
 * Se desautoriza el acceso y se conserva expiryDate como referencia histórica.
 */
async function handleCancelMembership(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      autorizado: false,
      cancelledAt: serverTimestamp()
    });

    showAlert('Mensualidad anulada correctamente.', 'success');
    await loadMensualidades();
  } catch (error) {
    console.error('Error al anular mensualidad:', error);
    showAlert('Error al anular mensualidad', 'error');
  }
}

function renderMensualidades() {
  const tbody = $tbody();
  if (!tbody) return;

  tbody.innerHTML = '';

  const stateFilter = $filter()?.value || 'all';
  const order = $sort()?.value || 'az';
  const queryText = norm($search()?.value || '');
  const tokens = queryText.split(/\s+/).filter(Boolean);

  const crMin = currentYearMonthStr();

  let list = usersCache
    .map(user => ({ ...user, __state: getMembershipState(user) }))
    .filter(user => {
      const oculto = isOculto(user);
      if (stateFilter === 'ocultos') {
        if (!oculto) return false;
      } else {
        if (oculto) return false;
      }

      if (stateFilter === 'activo' && user.__state !== 'Activo') return false;
      if (stateFilter === 'proxima' && user.__state !== 'Próxima a vencer') return false;
      if (stateFilter === 'vencida' && user.__state !== 'Vencida') return false;

      if (!tokens.length) return true;

      const hay = norm(`${user.nombre || ''} ${user.correo || ''}`);
      return tokens.every(t => hay.includes(t));
    });

  list.sort((a, b) => {
    const an = norm(a.nombre);
    const bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return order === 'za' ? -cmp : cmp;
  });

  renderMensPager(list.length);

  const start = (MENS_PAGE - 1) * MENS_PER_PAGE;
  list = list.slice(start, start + MENS_PER_PAGE);

  const frag = document.createDocumentFragment();

  list.forEach(user => {
    const uid = user.id;
    const exp = user.expiryDate || '—';
    const state = user.__state;
    const cls = stateToClass(state);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.nombre || ''}</td>
      <td>${user.correo || ''}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${user.autorizado ? 'checked' : ''} data-uid="${uid}">
          <span class="slider round"></span>
        </label>
      </td>
      <td>${exp}</td>
      <td><span class="${cls}">${state}</span></td>
      <td>
        <input
          type="month"
          id="month-${uid}"
          min="${crMin}"
          value="${exp === '—' ? '' : exp.slice(0, 7)}"
        >
      </td>
      <td>
        <div class="mensualidad-actions">
          <button class="btnPay btn" data-uid="${uid}" type="button">Guardar</button>
          <button class="btnCancelMens btn btn-danger-soft" data-uid="${uid}" type="button">Anular</button>
        </div>
      </td>
    `;
    frag.appendChild(tr);
  });

  tbody.appendChild(frag);

  tbody.onclick = async (e) => {
    const toggle = e.target.closest('input[type="checkbox"][data-uid]');
    const btnPay = e.target.closest('.btnPay[data-uid]');
    const btnCancel = e.target.closest('.btnCancelMens[data-uid]');

    if (toggle) {
      const uid = toggle.getAttribute('data-uid');
      const checked = toggle.checked;

      try {
        await updateDoc(doc(db, 'users', uid), { autorizado: checked });
        showAlert('Autorización actualizada', 'success');
        await loadMensualidades();
      } catch (error) {
        console.error('Error al actualizar autorización:', error);
        showAlert('Error al actualizar', 'error');
        toggle.checked = !checked;
      }
      return;
    }

    if (btnPay) {
      await handleSavePayment(btnPay.getAttribute('data-uid'));
      return;
    }

    if (btnCancel) {
      await handleCancelMembership(btnCancel.getAttribute('data-uid'));
    }
  };
}

async function initProtected() {
  if (window.lucide) {
    try {
      window.lucide.createIcons();
    } catch {}
  }

  await loadMensualidades();

  $filter()?.addEventListener('change', () => {
    MENS_PAGE = 1;
    renderMensualidades();
  });

  $sort()?.addEventListener('change', () => {
    MENS_PAGE = 1;
    renderMensualidades();
  });

  const debounced = debounce(() => {
    MENS_PAGE = 1;
    renderMensualidades();
  }, 150);

  $search()?.addEventListener('input', () => {
    if ($clear()) $clear().style.display = ($search().value ? 'inline-flex' : 'none');
    debounced();
  });

  $clear()?.addEventListener('click', () => {
    if ($search()) $search().value = '';
    if ($clear()) $clear().style.display = 'none';
    MENS_PAGE = 1;
    renderMensualidades();
  });
}

ready(() => {
  ensureNavCSS();
  bindSidebarOnce();
  bindLogoutOnce();

  gateAdminPage()
    .then(initProtected)
    .catch(() => {});
});