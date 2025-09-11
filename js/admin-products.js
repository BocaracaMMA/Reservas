// ./js/admin-products.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert } from './showAlert.js';

const ADMINS = [
  "TWAkND9zF0UKdMzswAPkgas9zfL2",
  "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"
];

document.addEventListener('DOMContentLoaded', () => {
  // Seguridad
  onAuthStateChanged(auth, user => {
    if (!user || !ADMINS.includes(user.uid)) window.location.href = './index.html';
  });

  // Sidebar toggle
  const t = document.getElementById('toggleNav');
  const s = document.getElementById('sidebar');
  if (t && s) t.addEventListener('click', ()=> s.classList.toggle('active'));

  // Quill
  const quill = new Quill('#pDescEditor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold','italic','underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link','image']
      ]
    }
  });
  const hiddenDesc = document.getElementById('pDesc');

  // DOM
  const form   = document.getElementById('productForm');
  const tbody  = document.getElementById('productsTbody');
  const cancel = document.getElementById('cancelBtn');

  const fTitle  = document.getElementById('pTitle');
  const fPrice  = document.getElementById('pPrice');
  const fStock  = document.getElementById('pStock');
  const fImgF   = document.getElementById('pImageFile'); // archivo
  const fImgU   = document.getElementById('pImageUrl');  // url (se rellena sola)
  const fActive = document.getElementById('pActive');
  const fPreview = document.getElementById('pImagePreview'); // si lo agregaste

  const storage = getStorage();
  let editingId = null;

  // Subir archivo original SIN recorte
  fImgF.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('El archivo debe ser una imagen.', 'error');
      fImgF.value = '';
      return;
    }
    try {
      const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const r    = sRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      fImgU.value = url;
      if (fPreview) { fPreview.src = url; fPreview.style.display = 'block'; }
      showAlert('Imagen subida correctamente', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Error subiendo la imagen', 'error');
    } finally {
      fImgF.value = '';
    }
  });

  // Guardar / actualizar
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hiddenDesc.value = quill.root.innerHTML;

    const data = {
      title: (fTitle.value || '').trim(),
      price: Number(fPrice.value || 0),
      stock: Number(fStock.value || 0),
      imageUrl: (fImgU.value || '').trim(),
      active: !!fActive.checked,
      description: hiddenDesc.value,
      createdAt: Date.now()
    };
    if (!data.title) return showAlert('Título requerido', 'error');

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), data);
        showAlert('Producto actualizado', 'success');
      } else {
        await addDoc(collection(db, 'products'), data);
        showAlert('Producto creado', 'success');
      }
      editingId = null;
      form.reset();
      quill.setContents([]);
      if (fPreview) fPreview.style.display = 'none';
    } catch (err) {
      console.error(err);
      showAlert('Error guardando', 'error');
    }
  });

  cancel.addEventListener('click', () => {
    editingId = null;
    form.reset();
    quill.setContents([]);
    if (fPreview) fPreview.style.display = 'none';
  });

  // Listado (con switch de Activo)
  onSnapshot(collection(db, 'products'), (snap) => {
    tbody.innerHTML = '';
    snap.docs.forEach(d => {
      const p  = d.data();
      const id = d.id;
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${p.title || ''}</td>
        <td>₡${Number(p.price || 0).toFixed(2)}</td>
        <td>${Number(p.stock || 0)}</td>
        <td>
          <label class="switch" title="Activo">
            <input type="checkbox" class="pActiveSwitch" data-id="${id}" ${p.active ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="btn small" data-id="${id}" data-a="edit">✏️</button>
          <button class="btn small error" data-id="${id}" data-a="del">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  // Acciones tabla (editar, borrar, cambiar activo)
  tbody.addEventListener('change', async (ev) => {
    const sw = ev.target.closest('.pActiveSwitch');
    if (!sw) return;
    const id = sw.dataset.id;
    const checked = sw.checked;
    try {
      await updateDoc(doc(db, 'products', id), { active: checked });
      showAlert(checked ? 'Producto visible' : 'Producto oculto', 'success');
    } catch (e) {
      sw.checked = !checked;
      showAlert('No se pudo cambiar el estado', 'error');
    }
  });

  tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const a  = btn.dataset.a;

    if (a === 'edit') {
      const snap = await getDoc(doc(db, 'products', id));
      const p = snap.data() || {};
      editingId = id;
      fTitle.value     = p.title || '';
      fPrice.value     = Number(p.price || 0);
      fStock.value     = Number(p.stock || 0);
      fImgU.value      = p.imageUrl || '';
      fActive.checked  = !!p.active;
      quill.root.innerHTML = p.description || '';
      if (fPreview) {
        if (p.imageUrl) { fPreview.src = p.imageUrl; fPreview.style.display = 'block'; }
        else { fPreview.style.display = 'none'; }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (a === 'del') {
      if (confirm('¿Eliminar producto?')) {
        await deleteDoc(doc(db, 'products', id));
        showAlert('Producto eliminado', 'success');
        if (editingId === id) {
          editingId = null;
          form.reset();
          quill.setContents([]);
          if (fPreview) fPreview.style.display = 'none';
        }
      }
    }
  });
});
