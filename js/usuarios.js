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

// ─── 0) Función auxiliar para enganchar el toggleNav ─────────────────────────
function setupSidebarToggle() {
  const toggleButton = document.getElementById("toggleNav");
  const sidebar      = document.getElementById("sidebar");
  if (toggleButton && sidebar) {
    toggleButton.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }
}

// ➤ Enganchamos también **ANTES** de DOMContentLoaded, igual que en admin.js
setupSidebarToggle();

document.addEventListener("DOMContentLoaded", () => {
  // 1) Auto‑logout por inactividad
  setupInactivityTimeout();

  // 2) Volver a enganchar toggle (por si llegó tarde)
  setupSidebarToggle();

  // 3) Seguridad: solo admins
  onAuthStateChanged(auth, user => {
    const ADMIN_UIDS = [
      "TWAkND9zF0UKdMzswAPkgas9zfL2",
      "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"
    ];
    if (!user || !ADMIN_UIDS.includes(user.uid)) {
      window.location.href = './index.html';
    }
  });

  // 4) Logout desde el sidebar
  const logoutSidebar = document.getElementById("logoutSidebar");
  if (logoutSidebar) {
    logoutSidebar.addEventListener("click", async e => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert("Has cerrado sesión", "success");
        setTimeout(() => window.location.href = "index.html", 1000);
      } catch {
        showAlert("Error al cerrar sesión", "error");
      }
    });
  }

  // 5) Cargar tabla de usuarios
  loadUsers();
});


// ─── Generador de código de 4 dígitos ────────────────────────────────────────
function randomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function generateUniqueCode() {
  let code, exists = true;
  while (exists) {
    code = randomCode();
    const q = query(collection(db, 'users'), where('attendanceCode', '==', code));
    const snap = await getDocs(q);
    exists = !snap.empty;
  }
  return code;
}


// ─── Renderizado de usuarios ─────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.querySelector("#usuarios-table tbody");
  tbody.innerHTML = "";

  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach(docSnap => {
    const u   = docSnap.data();
    const uid = docSnap.id;
    const tr  = document.createElement("tr");
    tr.id     = `row-${uid}`;
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.correo}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado ? 'checked' : ''} data-id="${uid}">
          <span class="slider round"></span>
        </label>
      </td>
      <td id="code-${uid}">${u.attendanceCode || '—'}</td>
      <td>
        <button class="btn code-btn" data-uid="${uid}">🎲</button>
      </td>
    `;
    tbody.appendChild(tr);

    // listener para el switch “autorizado”
    tr.querySelector("input[type='checkbox']").addEventListener("change", async e => {
      try {
        await updateDoc(doc(db, "users", uid), { autorizado: e.target.checked });
        showAlert("Estado actualizado correctamente", "success");
      } catch {
        showAlert("No se pudo actualizar el estado.", "error");
      }
    });
  });

  // listener para los botones “🎲” de regenerar código
  document.querySelectorAll('.code-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      try {
        const newCode = await generateUniqueCode();
        await updateDoc(doc(db, 'users', uid), { attendanceCode: newCode });
        document.getElementById(`code-${uid}`).textContent = newCode;
        showAlert(`Código actualizado: ${newCode}`, "success");
      } catch (err) {
        console.error("Error generando attendanceCode:", err);
        showAlert("Error al generar el código.", "error");
      }
    });
  });
}
