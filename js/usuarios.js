// ./js/usuarios.js

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupInactivityTimeout } from './auth-timeout.js';
import {
  collection,
  query,
  where,
  updateDoc,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// ─── Sidebar ─────────────────────────────────────────────────────────
function setupSidebarToggle() {
  const toggleButton = document.getElementById("toggleNav");
  const sidebar      = document.getElementById("sidebar");
  if (toggleButton && sidebar) {
    toggleButton.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }
}
setupSidebarToggle();

// ─── Estado de UI ───────────────────────────────────────────────────
let usersCache = []; // { id, nombre, correo, autorizado, attendanceCode, ... }

const $tbody      = () => document.querySelector("#usuarios-table tbody");
const $filter     = () => document.getElementById("filterState");
const $sort       = () => document.getElementById("sortBy");

// Normaliza para ordenar ignorando acentos y mayúsculas
const norm = s => (s ?? '')
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase();

// ─── Inicio ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupInactivityTimeout();
  setupSidebarToggle();

  onAuthStateChanged(auth, user => {
    const ADMIN_UIDS = [
      "vVUIH4IYqOOJdQJknGCjYjmKwUI3",
      "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"
    ];
    if (!user || !ADMIN_UIDS.includes(user.uid)) {
      window.location.href = './index.html';
    }
  });

  const logoutSidebar = document.getElementById("logoutSidebar");
  if (logoutSidebar) {
    logoutSidebar.addEventListener("click", async e => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert("Has cerrado sesión", "success");
        setTimeout(() => (window.location.href = "index.html"), 1000);
      } catch {
        showAlert("Error al cerrar sesión", "error");
      }
    });
  }

  // cargar y enganchar filtros
  loadUsers().then(() => {
    if ($filter()) $filter().addEventListener('change', renderUsers);
    if ($sort())   $sort().addEventListener('change', renderUsers);
  });
});

// ─── Helpers de datos ───────────────────────────────────────────────
function updateUserInCache(id, patch) {
  const i = usersCache.findIndex(u => u.id === id);
  if (i >= 0) usersCache[i] = { ...usersCache[i], ...patch };
}

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

// ─── Carga inicial ──────────────────────────────────────────────────
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers();
}

// ─── Render con filtros y orden ─────────────────────────────────────
function renderUsers() {
  const tbody = $tbody();
  if (!tbody) return;
  tbody.innerHTML = "";

  const state = $filter() ? $filter().value : 'all'; // all | auth | noauth
  const order = $sort() ? $sort().value   : 'az';   // az  | za

  // 1) filtrar
  let list = usersCache.filter(u => {
    if (state === 'auth')   return !!u.autorizado;
    if (state === 'noauth') return !u.autorizado;
    return true; // all
  });

  // 2) ordenar
  list.sort((a, b) => {
    const an = norm(a.nombre);
    const bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return order === 'za' ? -cmp : cmp;
  });

  // 3) dibujar
  list.forEach(u => {
    const tr  = document.createElement("tr");
    tr.id     = `row-${u.id}`;
    tr.innerHTML = `
      <td>${u.nombre ?? ''}</td>
      <td>${u.correo ?? ''}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado ? 'checked' : ''} data-id="${u.id}">
          <span class="slider round"></span>
        </label>
      </td>
      <td id="code-${u.id}">${u.attendanceCode || '—'}</td>
      <td><button class="btn code-btn" data-uid="${u.id}">🎲</button></td>
    `;
    tbody.appendChild(tr);

    // Toggle autorizado
    tr.querySelector("input[type='checkbox']").addEventListener("change", async e => {
      const checked = e.target.checked;
      try {
        await updateDoc(doc(db, "users", u.id), { autorizado: checked });
        updateUserInCache(u.id, {autorizado: checked});
        showAlert("Estado actualizado correctamente", "success");
        // Reaplicar filtros/orden (por si el registro ya no debe verse)
        renderUsers();
      } catch {
        showAlert("No se pudo actualizar el estado.", "error");
        // revertir visual si falló
        e.target.checked = !checked;
      }
    });

    // Botón para regenerar el código
    tr.querySelector('.code-btn').addEventListener('click', async () => {
      try {
        const newCode = await generateUniqueCode();
        await updateDoc(doc(db, 'users', u.id), { attendanceCode: newCode });
        updateUserInCache(u.id, { attendanceCode: newCode });
        const cell = document.getElementById(`code-${u.id}`);
        if (cell) cell.textContent = newCode;
        showAlert(`Código actualizado: ${newCode}`, "success");
      } catch (err) {
        console.error("Error generando attendanceCode:", err);
        showAlert("Error al generar el código.", "error");
      }
    });
  });
}
