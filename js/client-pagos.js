// ./js/client-pagos.js
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert } from './showAlert.js';

const WA_NUMBER = '50664289694';

/**
 * Sidebar móvil.
 */
(function initSidebar() {
  const btn = document.getElementById('toggleNav');
  const sidebar = document.getElementById('sidebar');

  if (!btn || !sidebar) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'sidebarBackdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const toggleSidebar = (open) => {
    const shouldOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('active');
    sidebar.classList.toggle('active', shouldOpen);
    backdrop.classList.toggle('active', shouldOpen);
    document.body.style.overflow = shouldOpen ? 'hidden' : '';
  };

  btn.addEventListener('click', () => toggleSidebar());
  backdrop.addEventListener('click', () => toggleSidebar(false));
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) {
      toggleSidebar(false);
    }
  });

  document.getElementById('logoutSidebar')?.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await signOut(auth);
    } finally {
      location.href = 'index.html';
    }
  });
})();

const sessionEmail = document.getElementById('sessionEmail');
const form = document.getElementById('payForm');
const nameEl = document.getElementById('pfName');
const idEl = document.getElementById('pfCedula');
const methodEl = document.getElementById('payMethod');
const payTypeEl = document.getElementById('payType');
const monthEl = document.getElementById('payMonth');
const otherDetailEl = document.getElementById('payOtherDetail');
const detailLabelEl = document.getElementById('payDetailLabel');
const amountEl = document.getElementById('payAmount');
const codeEl = document.getElementById('payCode');
const fileInput = document.getElementById('payFile');
const fileName = document.getElementById('fileName');
const drop = document.getElementById('drop');
const sendBtn = document.getElementById('sendBtn');
const payStatus = document.getElementById('payStatus');

const previewWrap = document.getElementById('previewWrap');
const previewImg = document.getElementById('previewImg');

let previewURL = null;

/**
 * Limpia la preview del archivo.
 */
function clearPreview() {
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }

  if (previewImg) previewImg.src = '';
  if (previewWrap) previewWrap.hidden = true;
}

/**
 * Muestra preview del comprobante.
 */
function showPreview(file) {
  clearPreview();

  if (!file) return;

  previewURL = URL.createObjectURL(file);
  previewImg.src = previewURL;
  previewWrap.hidden = false;
}

/**
 * Actualiza nombre y preview del archivo.
 */
function updateFileName() {
  const file = fileInput.files?.[0];
  if (fileName) fileName.textContent = file?.name || '';
  showPreview(file || null);
}

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', (event) => {
  event.preventDefault();
  drop.classList.add('drag');
});
drop.addEventListener('dragleave', () => {
  drop.classList.remove('drag');
});
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('drag');

  if (event.dataTransfer.files?.[0]) {
    fileInput.files = event.dataTransfer.files;
    updateFileName();
  }
});
fileInput.addEventListener('change', updateFileName);

/**
 * Convierte un monto de entrada a número.
 */
function parseMonto(value) {
  if (!value) return NaN;

  let normalized = String(value).trim();
  normalized = normalized.replace(/[^\d.,-]/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  return Number(normalized);
}

/**
 * Formatea mes YYYY-MM a texto.
 */
function formatMonthLabel(ym) {
  if (!ym) return '—';

  const parts = String(ym).split('-').map(Number);
  if (parts.length !== 2 || parts.some(n => !Number.isFinite(n))) return String(ym);

  const [year, month] = parts;
  return new Date(year, month - 1, 1).toLocaleDateString('es-CR', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Coloca el mes actual.
 */
function setDefaultMonth() {
  const now = new Date();
  monthEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ajusta el formulario según el tipo de pago seleccionado.
 */
function syncPaymentModeUI() {
  const paymentType = payTypeEl.value;

  if (paymentType === 'otro') {
    detailLabelEl.textContent = 'Detalle del pago';
    monthEl.hidden = true;
    monthEl.required = false;
    otherDetailEl.hidden = false;
    otherDetailEl.required = true;
  } else {
    detailLabelEl.textContent = 'Mes que estás pagando';
    monthEl.hidden = false;
    monthEl.required = true;
    otherDetailEl.hidden = true;
    otherDetailEl.required = false;
    otherDetailEl.value = '';
    setDefaultMonth();
  }
}

/**
 * Sube el comprobante, registra el pago y abre WhatsApp.
 */
async function submitPaymentProof({
  uid,
  nombre,
  cedula,
  metodo,
  monto,
  mesStr,
  codigo,
  file,
  paymentType,
  detallePago,
  origin = 'client-pagos'
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.getTime();
  const safeName = file.name.replace(/[^\w.\-]/g, '_');
  const filePath = `payments/${uid}/${year}/${month}/${timestamp}_${safeName}`;

  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'image/jpeg'
  });

  const fileURL = await getDownloadURL(storageRef);

  const payload = {
    uid,
    nombre,
    cedula,
    metodo,
    monto,
    filePath,
    fileURL,
    status: 'pendiente',
    paymentType,
    detallePago: paymentType === 'otro' ? detallePago : null,
    codigo: codigo || null,
    createdAt: serverTimestamp(),
    origin
  };

  if (paymentType === 'membresia') {
    payload.mesPagado = mesStr;
    payload.mes = mesStr;
    payload.mesPagadoHuman = formatMonthLabel(mesStr);
  }

  const paymentDoc = await addDoc(collection(db, 'payments'), payload);

  const message = [
    '*Nuevo comprobante de pago*',
    `Nombre: ${nombre}`,
    `Cédula: ${cedula}`,
    `Método: ${metodo}`,
    `Monto: ${monto}`,
    `Tipo: ${paymentType === 'otro' ? 'OTRO' : 'PAGO MEMBRESIA'}`,
    paymentType === 'otro'
      ? `Detalle: ${detallePago}`
      : `Mes: ${formatMonthLabel(mesStr)} (${mesStr})`,
    codigo ? `Código: ${codigo}` : null,
    `Archivo: ${fileURL}`,
    `ID registro: ${paymentDoc.id}`
  ].filter(Boolean).join('\n');

  window.location.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = 'index.html';
    return;
  }

  sessionEmail.textContent = `Sesión: ${user.email || '—'}`;
  setDefaultMonth();
  syncPaymentModeUI();

  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    if (userData.nombre) nameEl.value = userData.nombre;
    if (userData.cedula) idEl.value = userData.cedula;
  } catch (error) {
    console.warn('No se pudo precargar perfil:', error);
  }
});

payTypeEl.addEventListener('change', syncPaymentModeUI);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = fileInput.files?.[0];
  if (!file) {
    showAlert('Adjunta la imagen del comprobante.', 'error');
    return;
  }

  if (!/^image\//i.test(file.type || '')) {
    showAlert('El comprobante debe ser una imagen.', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showAlert('Máximo 10 MB por imagen.', 'error');
    return;
  }

  const nombre = nameEl.value.trim();
  const cedula = idEl.value.trim();
  const metodo = methodEl.value.trim();
  const paymentType = payTypeEl.value;
  const mesStr = monthEl.value;
  const detallePago = otherDetailEl.value.trim();
  const monto = parseMonto(amountEl.value);
  const codigo = codeEl.value.trim();

  if (!nombre || !cedula || !metodo || !Number.isFinite(monto)) {
    showAlert('Revisa los datos: nombre, cédula, método y monto son obligatorios.', 'error');
    return;
  }

  if (paymentType === 'membresia' && !mesStr) {
    showAlert('Selecciona el mes que estás pagando.', 'error');
    return;
  }

  if (paymentType === 'otro' && !detallePago) {
    showAlert('Escribe el detalle del pago.', 'error');
    return;
  }

  try {
    sendBtn.disabled = true;
    payStatus.classList.add('show');

    const currentUser = auth.currentUser;

    await submitPaymentProof({
      uid: currentUser.uid,
      nombre,
      cedula,
      metodo,
      monto,
      mesStr,
      codigo,
      file,
      paymentType,
      detallePago,
      origin: 'client-pagos'
    });

    showAlert('Comprobante enviado a WhatsApp.', 'success');
    form.reset();
    setDefaultMonth();
    syncPaymentModeUI();
    updateFileName();
  } catch (error) {
    console.error('Error enviando comprobante:', error);
    showAlert('No se pudo subir o enviar el comprobante.', 'error');
  } finally {
    payStatus.classList.remove('show');
    sendBtn.disabled = false;
  }
});

window.addEventListener('beforeunload', clearPreview);