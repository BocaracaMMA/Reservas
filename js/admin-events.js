// ./js/admin-events.js
import { auth, db, app } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js"; // *** CROP INICIO ***
import Cropper from 'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.esm.js';      // *** CROP INICIO ***
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1) Sidebar toggle
  const toggleBtn     = document.getElementById('toggleNav');
  const sidebar       = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('active'));
  }

  // 2) Logout desde sidebar
  const logoutSidebar = document.getElementById('logoutSidebar');
  if (logoutSidebar) {
    logoutSidebar.addEventListener('click', async e => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert('Has cerrado sesión', 'success');
        setTimeout(() => window.location.href = 'index.html', 1500);
      } catch {
        showAlert('Error al cerrar sesión', 'error');
      }
    });
  }

  // 3) Seguridad: solo administradores
  onAuthStateChanged(auth, user => {
    const ADMINS = [
      "TWAkND9zF0UKdMzswAPkgas9zfL2", // Iván
      "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"  // Luis
    ];
    if (!user || !ADMINS.includes(user.uid)) {
      window.location.href = './index.html';
    }
  });

  // 4) Capturar DOM del CRUD
  const form      = document.getElementById('eventForm');
  const tblBody   = document.getElementById('eventsTbody');
  const cancelBtn = document.getElementById('cancelBtn');

  if (!form || !tblBody || !cancelBtn) {
    console.error('Faltan elementos clave en el DOM');
    return;
  }

  // *** CROP INICIO ***
  // referencias para cropper
  const imageFileInput = document.getElementById('imageFile');
  const cropperModal   = document.getElementById('cropperModal');
  const cropperImage   = document.getElementById('cropperImage');
  const cropBtn        = document.getElementById('cropBtn');
  const cancelCropBtn  = document.getElementById('cancelCropBtn');
  let   cropper        = null;
  let   rawFile        = null;
  const storage        = getStorage(app);

  // al seleccionar archivo, abrimos modal con Cropper
  imageFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    rawFile = file;
    cropperImage.src = URL.createObjectURL(file);
    cropperModal.classList.add('active');
    if (cropper) cropper.destroy();
    cropper = new Cropper(cropperImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1
    });
  });

  // cancelar recorte
  cancelCropBtn.addEventListener('click', () => {
    cropper.destroy();
    cropper = null;
    cropperModal.classList.remove('active');
    imageFileInput.value = '';
  });

  // recortar y subir
  cropBtn.addEventListener('click', () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 500, height: 500 });
    canvas.toBlob(async blob => {
      try {
        const filename = `events/${Date.now()}_${rawFile.name}`;
        const ref      = storageRef(storage, filename);
        await uploadBytes(ref, blob);
        const url = await getDownloadURL(ref);
        // colocamos la URL en el input oculto de imageUrl
        document.getElementById('imageUrl').value = url;
        showAlert('Imagen recortada y subida','success');
      } catch (err) {
        console.error('Error subiendo imagen:', err);
        showAlert('Error al subir imagen','error');
      } finally {
        cropper.destroy();
        cropper = null;
        cropperModal.classList.remove('active');
      }
    }, rawFile.type);
  });
  // *** CROP FIN ***

  // 5) Inicializar Quill para descripción
  const quill = new Quill('#descriptionEditor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold','italic','underline','strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link','image']
      ]
    }
  });
  const hiddenDesc = document.getElementById('description');

  // 6) Formateo de fechas
  function formatDateStr(dateStr) {
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    const opts = { weekday:'long', day:'numeric', month:'long' };
    return new Intl.DateTimeFormat('es-CR', opts)
      .format(dt)
      .replace(/^\w/, c => c.toUpperCase());
  }

  let editingId = null;
  const fields = ['title','imageUrl','from','to','description','ticketsUrl'];

  // 7) Crear / actualizar evento
  form.addEventListener('submit', async e => {
    e.preventDefault();
    hiddenDesc.value = quill.root.innerHTML;
    const data = {
      title:       document.getElementById('title').value.trim(),
      imageUrl:    document.getElementById('imageUrl').value.trim(),
      from:        document.getElementById('from').value,
      to:          document.getElementById('to').value,
      description: hiddenDesc.value,
      ticketsUrl:  document.getElementById('ticketsUrl').value.trim(),
      createdAt:   Date.now()
    };
    try {
      if (editingId) {
        await updateDoc(doc(db,'events',editingId), data);
        showAlert('Evento actualizado','success');
      } else {
        await addDoc(collection(db,'events'), data);
        showAlert('Evento creado','success');
      }
      editingId = null;
      form.reset();
      quill.setContents([]);
    } catch(err) {
      console.error('Error guardando evento:', err);
      showAlert('Error guardando evento','error');
    }
  });

  // 8) Cancelar edición
  cancelBtn.addEventListener('click', () => {
    editingId = null;
    form.reset();
    quill.setContents([]);
  });

  // 9) Listar en tiempo real
  onSnapshot(collection(db,'events'), snap => {
    tblBody.innerHTML = '';
    snap.docs.forEach(docSnap => {
      const e  = docSnap.data();
      const id = docSnap.id;
      const fromFmt = formatDateStr(e.from);
      const toFmt   = formatDateStr(e.to);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.title}</td>
        <td>
          <div class="date-range">
            <span>${fromFmt}</span>
            <span class="arrow">→</span>
            <span>${toFmt}</span>
          </div>
        </td>
        <td>
          <button class="btn small" data-id="${id}" data-action="edit">✏️</button>
          <button class="btn small error" data-id="${id}" data-action="del">🗑️</button>
        </td>`;
      tblBody.appendChild(tr);
    });
  }, err => console.error('Snapshot error eventos:', err));

  // 10) Delegar botones Editar/Eliminar
  tblBody.addEventListener('click', async ev => {
    const btn = ev.target.closest('button');
    if (!btn || !btn.dataset.id) return;
    const { id, action } = btn.dataset;

    if (action === 'edit') {
      const snap = await getDoc(doc(db,'events',id));
      const data = snap.data() || {};
      fields.forEach(f => {
        if (f === 'description') {
          quill.root.innerHTML = data.description || '';
        } else {
          const el = document.getElementById(f);
          if (el && data[f] !== undefined) el.value = data[f];
        }
      });
      editingId = id;
    }

    if (action === 'del' && confirm('¿Eliminar este evento?')) {
      try {
        await deleteDoc(doc(db,'events',id));
        showAlert('Evento borrado','success');
        if (editingId === id) {
          editingId = null;
          form.reset();
          quill.setContents([]);
        }
      } catch(err) {
        console.error('Error eliminando evento:', err);
        showAlert('Error eliminando evento','error');
      }
    }
  });
});

// 11) Fallback global para toggle sidebar
(function(){
  const t = document.getElementById('toggleNav');
  const s = document.getElementById('sidebar');
  if (t && s) {
    t.addEventListener('click', () => s.classList.toggle('active'));
  }
})();
