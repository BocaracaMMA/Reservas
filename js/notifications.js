// ./js/notifications.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────
// UI: campana + modal
// ─────────────────────────────────────────────────────────────
const bell = document.createElement('button');
bell.type = 'button';
bell.className = 'btn notify-bell medium';
bell.innerHTML = `<i class="bi bi-bell-fill"></i><span class="badge" id="notifBadge">0</span>`;
bell.title = 'Notificaciones';

// Intenta colocar la campana a la izquierda del botón de escaneo
// Si no existe (en otra página), cae a flotante en esquina.
const scanBtn = document.getElementById('openScannerBtn');
const scanBar = scanBtn ? scanBtn.parentElement : null;
if (scanBar && scanBtn) {
  // Insertar ANTES del botón de escaneo
  scanBar.insertBefore(bell, scanBtn);
} else {
  // Fallback: flotante
  bell.style.position = 'fixed';
  bell.style.right = '16px';
  bell.style.bottom = '16px';
  document.body.appendChild(bell);
}

// Modal (reutiliza tu estilo .asistencia-modal)
const modal = document.createElement('div');
modal.className = 'asistencia-modal';
modal.innerHTML = `
  <div class="modal-content" style="max-width:420px;">
    <h3 style="margin-top:0">Notificaciones</h3>
    <div id="notifList" style="max-height:60vh; overflow:auto;"></div>
    <button id="notifClose" class="btn error" style="margin-top:12px;">Cerrar</button>
  </div>
`;
document.body.appendChild(modal);

const badge = bell.querySelector('#notifBadge');
const list  = modal.querySelector('#notifList');
modal.querySelector('#notifClose').onclick = () => modal.classList.remove('active');
bell.onclick = () => modal.classList.add('active');

// ─────────────────────────────────────────────────────────────
// Estado
// ─────────────────────────────────────────────────────────────
let unsub = null;

onAuthStateChanged(auth, user => {
  if (unsub) { unsub(); unsub = null; }
  if (badge) badge.textContent = '0';
  list.innerHTML = '';

  if (!user) return;

  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  unsub = onSnapshot(q, snap => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() })); // ← bug fix
    if (badge) badge.textContent = String(notifs.filter(n => !n.read).length);

    list.innerHTML = '';
    if (notifs.length === 0) {
      list.innerHTML = '<p style="color:#8b949e">Sin notificaciones.</p>';
      return;
    }

    notifs.forEach(n => {
      const item = document.createElement('div');
      item.style = 'border:1px solid #30363d; border-radius:10px; padding:.6rem .7rem; margin-bottom:.6rem; background:#161b22;';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:.5rem; align-items:center;">
          <div>
            <div style="font-weight:700">${n.title || 'Notificación'}</div>
            <div style="font-size:.9rem; color:#c9d1d9">${n.body || ''}</div>
            ${n.link ? `<a href="${n.link}" target="_blank" style="color:#58a6ff; font-size:.9rem;">Abrir</a>` : ''}
          </div>
          <button class="btn small" data-id="${n.id}" ${n.read ? 'disabled' : ''}>
            ${n.read ? 'Leída' : 'Marcar leída'}
          </button>
        </div>
      `;
      item.querySelector('button')?.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        try { await updateDoc(doc(db, 'notifications', id), { read: true }); }
        catch (err) { console.warn('No se pudo marcar leída:', err); }
      });
      list.appendChild(item);
    });
  });
});
