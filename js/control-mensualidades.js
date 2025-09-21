// ./js/control-mensualidades.js

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// ─── Estado de UI ───────────────────────────────────────────────────
let usersCache = []; // [{id, nombre, correo, autorizado, expiryDate, ...}]

// Helpers DOM para filtros (mismo naming que en usuarios)
const $tbody  = () => document.querySelector('#mensualidades-table tbody');
const $filter = () => document.getElementById('filterState'); // all|activo|proxima|vencida
const $sort   = () => document.getElementById('sortBy');      // az|za

// Normaliza strings para ordenar (sin acentos / case-insensitive)
const norm = s => (s ?? '')
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase();

// ─── Inicialización ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSidebarToggle();
  setupAuth();
  // Carga inicial + enganchar filtros
  loadMensualidades().then(() => {
    if ($filter()) $filter().addEventListener('change', renderMensualidades);
    if ($sort())   $sort().addEventListener('change', renderMensualidades);
  });
});

// ─── Sidebar toggle ────────────────────────────────────────────────
function setupSidebarToggle() {
  const btn = document.getElementById("toggleNav");
  const sb  = document.getElementById("sidebar");
  if (btn && sb) {
    btn.addEventListener("click", () => sb.classList.toggle("active"));
  }
}

// ─── Auth + logout ─────────────────────────────────────────────────
function setupAuth() {
  onAuthStateChanged(auth, user => {
    const ADMINS = [
      "vVUIH4IYqOOJdQJknGCjYjmKwUI3",
      "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"
    ];
    if (!user || !ADMINS.includes(user.uid)) {
      window.location.href = './index.html';
    }
  });
  const logoutBtn = document.getElementById('logoutSidebar');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async e => {
      e.preventDefault();
      await signOut(auth);
      showAlert('Sesión cerrada', 'success');
      setTimeout(() => window.location.href = 'index.html', 1000);
    });
  }
}

// ─── Helpers de fecha CR ───────────────────────────────────────────
function todayCRDate() {
  return new Date(new Date().toLocaleString('en-US', {
    timeZone: 'America/Costa_Rica'
  }));
}

function daysUntil(expiryDateStr) {
  if (!expiryDateStr) return -9999;
  const today = todayCRDate();
  const [y, m, d] = expiryDateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d);
  const diffMs = expiry - today;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Estado de membresía según reglas ──────────────────────────────
function getMembershipState(user) {
  if (!user.autorizado) return 'Vencida';
  const exp = user.expiryDate;
  if (!exp) return 'Vencida';
  const daysLeft = daysUntil(exp);
  if (daysLeft < 0)  return 'Vencida';
  if (daysLeft <= 5) return 'Próxima a vencer';
  return 'Activo';
}

// ─── Mapeo estado → clase CSS ─────────────────────────────────────
function stateToClass(state) {
  switch (state) {
    case 'Vencida':           return 'state-vencida';
    case 'Próxima a vencer':  return 'state-proxima';
    case 'Activo':            return 'state-activo';
    default:                  return '';
  }
}

// ─── Carga inicial (solo DB -> cache) ─────────────────────────────
async function loadMensualidades() {
  const snap = await getDocs(collection(db, 'users'));
  usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMensualidades();
}

// ─── Render con filtros/orden ─────────────────────────────────────
function renderMensualidades() {
  const tbody = $tbody();
  if (!tbody) return;
  tbody.innerHTML = '';

  const stateFilter = $filter() ? $filter().value : 'all'; // all|activo|proxima|vencida
  const order       = $sort() ? $sort().value     : 'az';  // az|za

  // 1) derivar estado y filtrar
  let list = usersCache
    .map(u => ({ ...u, __state: getMembershipState(u) })) // "Activo/Próxima a vencer/Vencida"
    .filter(u => {
      if (stateFilter === 'activo')  return u.__state === 'Activo';
      if (stateFilter === 'proxima') return u.__state === 'Próxima a vencer';
      if (stateFilter === 'vencida') return u.__state === 'Vencida';
      return true; // all
    });

  // 2) ordenar por nombre
  list.sort((a, b) => {
    const an = norm(a.nombre);
    const bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return order === 'za' ? -cmp : cmp;
  });

  // 3) pintar filas
  list.forEach(u => {
    const uid  = u.id;
    const exp  = u.expiryDate || '—';
    const st   = u.__state;
    const cls  = stateToClass(st);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nombre || ''}</td>
      <td>${u.correo || ''}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado ? 'checked' : ''} data-uid="${uid}">
          <span class="slider round"></span>
        </label>
      </td>
      <td>${exp}</td>
      <td class="${cls}">${st}</td>
      <td>
        <input type="month" id="month-${uid}" value="${exp==='—' ? '' : exp.slice(0,7)}">
      </td>
      <td>
        <button class="btnPay btn" data-uid="${uid}">Guardar</button>
      </td>
    `;
    tbody.appendChild(tr);

    // toggle autorizado
    tr.querySelector('input[type=checkbox]')
      .addEventListener('change', async e => {
        const checked = e.target.checked;
        try {
          await updateDoc(doc(db, 'users', uid), { autorizado: checked });
          showAlert('Autorización actualizada', 'success');
          // refrescamos cache y re-render para que re-calculen estados
          await loadMensualidades();
        } catch {
          showAlert('Error al actualizar', 'error');
          e.target.checked = !checked;
        }
      });

    // guardar pago
    tr.querySelector('.btnPay')
      .addEventListener('click', async () => {
        const monthVal = document.getElementById(`month-${uid}`).value;
        if (!monthVal) {
          showAlert('Selecciona un mes', 'error');
          return;
        }
        const [y, m] = monthVal.split('-').map(Number);
        const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
        try {
          await updateDoc(doc(db, 'users', uid), {
            expiryDate: lastDay,
            autorizado: true
          });
          showAlert('Pago registrado', 'success');
          await loadMensualidades();
        } catch {
          showAlert('Error al guardar pago', 'error');
        }
      });
  });
}
