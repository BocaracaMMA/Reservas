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

// ─── Inicialización ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSidebarToggle();
  setupAuth();
  loadMensualidades();
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
      "TWAkND9zF0UKdMzswAPkgas9zfL2",
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
  const today = todayCRDate();
  const [y, m, d] = expiryDateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d);
  const diffMs = expiry - today;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Estado de membresía según reglas ──────────────────────────────
function getMembershipState(user) {
  // 1) no autorizado → vencida
  if (!user.autorizado) {
    return 'Vencida';
  }
  // 2) autorizado → según expiryDate
  const exp = user.expiryDate;
  if (!exp) {
    return 'Vencida';
  }
  const daysLeft = daysUntil(exp);
  if (daysLeft < 0) {
    // 3) mes siguiente → vencida
    return 'Vencida';
  }
  if (daysLeft <= 5) {
    return 'Próxima a vencer';
  }
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

// ─── Cargar y renderizar la tabla ─────────────────────────────────
async function loadMensualidades() {
  const tbody = document.querySelector('#mensualidades-table tbody');
  tbody.innerHTML = '';
  const snap = await getDocs(collection(db, 'users'));

  snap.forEach(docSnap => {
    const u   = docSnap.data();
    const uid = docSnap.id;
    const state = getMembershipState(u);
    const exp   = u.expiryDate || '—';
    const cls   = stateToClass(state);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.correo}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado ? 'checked' : ''} data-uid="${uid}">
          <span class="slider round"></span>
        </label>
      </td>
      <td>${exp}</td>
      <td class="${cls}">${state}</td>
      <td>
        <input type="month" id="month-${uid}"
               value="${exp==='—'?'':exp.slice(0,7)}">
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
          loadMensualidades();
        } catch {
          showAlert('Error al actualizar', 'error');
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
          loadMensualidades();
        } catch {
          showAlert('Error al guardar pago', 'error');
        }
      });
  });
}
