// ./js/admin-events.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', () => {
  const form    = document.getElementById('eventForm');
  const tblBody = document.getElementById('eventsTbody');
  const fields  = ['title','imageUrl','from','to','description','ticketsUrl'];
  let editingId = null;

  onAuthStateChanged(auth, user => {
    const ADMINS = ["TWAkND9zF0UKdMzswAPkgas9zfL2","ScODWX8zq1ZXpzbbKk5vuHwSo7N2"];
    if (!user || !ADMINS.includes(user.uid)) window.location.href='./index.html';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      title:       document.getElementById('title').value.trim(),
      imageUrl:    document.getElementById('imageUrl').value.trim(),
      from:        document.getElementById('from').value,
      to:          document.getElementById('to').value,
      description: document.getElementById('description').value.trim(),
      ticketsUrl:  document.getElementById('ticketsUrl').value.trim(),
      createdAt:   Date.now()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'events', editingId), data);
        showAlert('Evento actualizado','success');
      } else {
        await addDoc(collection(db,'events'), data);
        showAlert('Evento creado','success');
      }
      editingId = null;
      form.reset();
    } catch {
      showAlert('Error guardando evento','error');
    }
  });

  document.getElementById('cancelBtn').onclick = () => {
    editingId = null;
    form.reset();
  };

  onSnapshot(collection(db,'events'), snap => {
    tblBody.innerHTML = '';
    snap.docs.forEach(docSnap => {
      const e  = docSnap.data(), id = docSnap.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.title}</td>
        <td>
          <div class="date-range">
            <span>${e.from}</span>
            <span class="arrow">→</span>
            <span>${e.to}</span>
          </div>
        </td>
        <td>
          <button class="btn small" data-id="${id}" data-action="edit">✏️</button>
          <button class="btn small error" data-id="${id}" data-action="del">🗑️</button>
        </td>`;
      tblBody.appendChild(tr);
    });
  });

  tblBody.addEventListener('click', async ev => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'edit') {
      const snap = await getDoc(doc(db,'events',id));
      const data = snap.data();
      fields.forEach(f => document.getElementById(f).value = data[f] || '');
      editingId = id;
    }

    if (btn.dataset.action === 'del' && confirm('¿Eliminar este evento?')) {
      await deleteDoc(doc(db,'events',id));
      showAlert('Evento borrado','success');
      if (editingId === id) {
        editingId = null;
        form.reset();
      }
    }
  });
});
