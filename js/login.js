// ./js/login.js
import { auth, db, storage } from './firebase-config.js';
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert } from './showAlert.js';
import { markLoginActivity } from './visibility-rules.js';

const adminEmails = [
  "luis.davidsolorzano@outlook.es",
  "ivan.cicc@hotmail.com"
];

const WA_NUMBER = '50664289694';
const BLOCK_FLAG = 'bocaracaLoginBlockedByExpiry';

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

const expiredModal = document.getElementById('expiredModal');
const expiredBackdrop = document.getElementById('expiredBackdrop');
const expiredClose = document.getElementById('expiredClose');
const expiredCancelBtn = document.getElementById('expiredCancelBtn');

const expiredMembershipType = document.getElementById('expiredMembershipType');
const expiredMembershipAmount = document.getElementById('expiredMembershipAmount');
const expiredExpiryDate = document.getElementById('expiredExpiryDate');

const expiredPaymentForm = document.getElementById('expiredPaymentForm');
const expiredPayMethod = document.getElementById('expiredPayMethod');
const expiredPayAmount = document.getElementById('expiredPayAmount');
const expiredPayMonth = document.getElementById('expiredPayMonth');
const expiredPayCode = document.getElementById('expiredPayCode');
const expiredPayFile = document.getElementById('expiredPayFile');
const expiredFileName = document.getElementById('expiredFileName');
const expiredDrop = document.getElementById('expiredDrop');
const expiredPreviewWrap = document.getElementById('expiredPreviewWrap');
const expiredPreviewImg = document.getElementById('expiredPreviewImg');
const expiredSendBtn = document.getElementById('expiredSendBtn');
const expiredPayStatus = document.getElementById('expiredPayStatus');

let failedAttempts = parseInt(localStorage.getItem('failedAttempts'), 10) || 0;
forgotPasswordLink.style.display = failedAttempts >= 3 ? 'block' : 'none';

let expiredPreviewURL = null;
let blockedUserContext = {
  uid: '',
  email: '',
  nombre: '',
  cedula: '',
  membresia: '',
  monto: '',
  expiryDate: ''
};

/**
 * Devuelve la fecha actual ajustada a Costa Rica.
 */
function getCostaRicaNow() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' })
  );
}

/**
 * Evalúa si el usuario debe considerarse vencido.
 * Bloquea si autorizado === false o si expiryDate ya pasó.
 */
function isExpiredUser(userData = {}) {
  if (userData.autorizado === false) return true;
  if (!userData.expiryDate) return false;

  const parts = String(userData.expiryDate).split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return false;

  const [year, month, day] = parts;
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  return endOfDay < getCostaRicaNow();
}

/**
 * Formatea fecha YYYY-MM-DD a formato local.
 */
function formatDateCR(dateStr) {
  if (!dateStr) return '—';

  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return '—';

  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
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
 * Presenta un monto como CRC o USD según el valor recibido.
 */
function formatMoneyDisplay(value) {
  if (value === null || value === undefined || value === '') return '—';

  const raw = String(value);
  const amount = Number(raw.replace(/[^\d.,-]/g, '').replace(/,/g, ''));

  if (!Number.isFinite(amount)) return raw;

  const isDollar = raw.includes('$');
  const currency = isDollar ? 'USD' : 'CRC';

  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Resuelve el nombre de la membresía desde distintas claves posibles.
 */
function resolveMembershipType(userData = {}) {
  return (
    userData.membresia ||
    userData.membershipType ||
    userData.plan ||
    userData.planName ||
    'Membresía General'
  );
}

/**
 * Resuelve el monto de la membresía.
 * Primero intenta leer campos directos y luego usa fallback por nombre de plan.
 */
function resolveMembershipAmount(userData = {}) {
  const directAmount =
    userData.montoMembresia ??
    userData.membershipAmount ??
    userData.monto ??
    userData.precioMembresia ??
    userData.planAmount;

  if (directAmount !== undefined && directAmount !== null && directAmount !== '') {
    return directAmount;
  }

  const membershipName = resolveMembershipType(userData).toLowerCase().trim();

  if (
    membershipName.includes('general') ||
    membershipName.includes('mensual') ||
    membershipName.includes('basica') ||
    membershipName.includes('básica')
  ) {
    return '$20';
  }

  if (membershipName.includes('gold')) return '$71';
  if (membershipName.includes('privad')) return '$50';

  return '$20';
}

/**
 * Coloca el mes actual por defecto.
 */
function setDefaultCurrentMonth(input) {
  if (!input) return;
  const now = new Date();
  input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Limpia la vista previa del comprobante.
 */
function clearExpiredPreview() {
  if (expiredPreviewURL) {
    URL.revokeObjectURL(expiredPreviewURL);
    expiredPreviewURL = null;
  }

  if (expiredPreviewImg) expiredPreviewImg.src = '';
  if (expiredPreviewWrap) expiredPreviewWrap.hidden = true;
}

/**
 * Actualiza nombre del archivo y preview.
 */
function updateExpiredFileName() {
  const file = expiredPayFile.files?.[0];
  expiredFileName.textContent = file?.name || '';

  clearExpiredPreview();

  if (!file) return;

  expiredPreviewURL = URL.createObjectURL(file);
  expiredPreviewImg.src = expiredPreviewURL;
  expiredPreviewWrap.hidden = false;
}

/**
 * Abre el modal de bloqueo y precarga los datos del usuario vencido.
 */
function openExpiredModal(context) {
  blockedUserContext = { ...blockedUserContext, ...context };

  expiredMembershipType.textContent = context.membresia || '—';
  expiredMembershipAmount.textContent = formatMoneyDisplay(context.monto);
  expiredExpiryDate.textContent = formatDateCR(context.expiryDate);

  expiredPaymentForm.reset();
  clearExpiredPreview();
  expiredFileName.textContent = '';
  setDefaultCurrentMonth(expiredPayMonth);

  const parsedAmount = parseMonto(context.monto);
  expiredPayAmount.value = Number.isFinite(parsedAmount) ? parsedAmount : '';

  expiredModal.hidden = false;
  document.body.classList.add('modal-open');
  sessionStorage.setItem(BLOCK_FLAG, '1');
}

/**
 * Cierra el modal.
 * No elimina la bandera de bloqueo para evitar accesos accidentales
 * mientras el usuario siga vencido.
 */
function closeExpiredModal() {
  expiredModal.hidden = true;
  document.body.classList.remove('modal-open');
  clearExpiredPreview();
}

/**
 * Sube comprobante a Storage, registra el pago en Firestore y abre WhatsApp.
 * Este flujo requiere mantener la sesión activa.
 */
async function submitMembershipProof({
  uid,
  nombre,
  cedula,
  metodo,
  monto,
  mesStr,
  codigo,
  file,
  membershipTypeSnapshot,
  membershipAmountSnapshot,
  origin
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
    mesPagado: mesStr,
    mes: mesStr,
    mesPagadoHuman: formatMonthLabel(mesStr),
    codigo: codigo || null,
    filePath,
    fileURL,
    status: 'pendiente',
    paymentType: 'membresia',
    detallePago: null,
    membershipTypeSnapshot: membershipTypeSnapshot || null,
    membershipAmountSnapshot: membershipAmountSnapshot || null,
    origin,
    createdAt: serverTimestamp()
  };

  const paymentDoc = await addDoc(collection(db, 'payments'), payload);

  const message = [
    '*Nuevo comprobante de pago*',
    `Nombre: ${nombre}`,
    `Cédula: ${cedula}`,
    `Método: ${metodo}`,
    `Monto: ${monto}`,
    'Tipo: PAGO MEMBRESIA',
    `Membresía: ${membershipTypeSnapshot || '—'}`,
    `Mes: ${formatMonthLabel(mesStr)} (${mesStr})`,
    codigo ? `Código: ${codigo}` : null,
    `Archivo: ${fileURL}`,
    `ID registro: ${paymentDoc.id}`
  ].filter(Boolean).join('\n');

  window.location.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

expiredDrop?.addEventListener('click', () => expiredPayFile.click());

expiredDrop?.addEventListener('dragover', (event) => {
  event.preventDefault();
  expiredDrop.classList.add('drag');
});

expiredDrop?.addEventListener('dragleave', () => {
  expiredDrop.classList.remove('drag');
});

expiredDrop?.addEventListener('drop', (event) => {
  event.preventDefault();
  expiredDrop.classList.remove('drag');

  if (event.dataTransfer.files?.[0]) {
    expiredPayFile.files = event.dataTransfer.files;
    updateExpiredFileName();
  }
});

expiredPayFile?.addEventListener('change', updateExpiredFileName);
expiredClose?.addEventListener('click', closeExpiredModal);
expiredCancelBtn?.addEventListener('click', closeExpiredModal);
expiredBackdrop?.addEventListener('click', closeExpiredModal);

expiredPaymentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = expiredPayFile.files?.[0];
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

  const metodo = expiredPayMethod.value.trim();
  const monto = parseMonto(expiredPayAmount.value);
  const mesStr = expiredPayMonth.value;
  const codigo = expiredPayCode.value.trim();

  if (!metodo || !mesStr || !Number.isFinite(monto)) {
    showAlert('Revisa los datos: método, mes y monto numérico son obligatorios.', 'error');
    return;
  }

  try {
    expiredSendBtn.disabled = true;
    expiredPayStatus.classList.add('show');

    await submitMembershipProof({
      uid: blockedUserContext.uid,
      nombre: blockedUserContext.nombre,
      cedula: blockedUserContext.cedula,
      metodo,
      monto,
      mesStr,
      codigo,
      file,
      membershipTypeSnapshot: blockedUserContext.membresia,
      membershipAmountSnapshot: blockedUserContext.monto,
      origin: 'login-vencido'
    });

    showAlert('Comprobante enviado a WhatsApp.', 'success');
  } catch (error) {
    console.error('Error enviando comprobante de usuario vencido:', error);
    showAlert('No se pudo subir o enviar el comprobante.', 'error');
  } finally {
    expiredPayStatus.classList.remove('show');
    expiredSendBtn.disabled = false;
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value?.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAlert('Por favor, ingrese un correo electrónico y una contraseña.', 'error');
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    if (!user || !user.email) {
      showAlert('Error: no se pudo iniciar sesión correctamente.', 'error');
      return;
    }

    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const isAdmin = adminEmails.includes(user.email);

    if (!isAdmin && isExpiredUser(userData)) {
      const displayName = [
        userData.nombre || '',
        userData.apellidos || ''
      ].join(' ').trim() || user.email || 'Usuario';

      openExpiredModal({
        uid: user.uid,
        email: user.email,
        nombre: displayName,
        cedula: userData.cedula || userData.cedulaExtranjera || '',
        membresia: resolveMembershipType(userData),
        monto: resolveMembershipAmount(userData),
        expiryDate: userData.expiryDate || ''
      });

      showAlert('Tu mensualidad está vencida. Debes enviar el comprobante para poder ingresar.', 'error');
      return;
    }

    sessionStorage.removeItem(BLOCK_FLAG);
    await markLoginActivity(user.uid);

    showAlert('¡Bienvenido!', 'success');
    localStorage.setItem('failedAttempts', '0');
    failedAttempts = 0;

    setTimeout(() => {
      if (isAdmin) {
        window.location.href = './admin-dashboard.html';
      } else {
        window.location.href = './client-dashboard.html';
      }
    }, 1200);

  } catch (error) {
    console.error('Error al iniciar sesión:', error.code, error.message);
    showAlert(`Error: ${error.code} - ${error.message}`, 'error');

    failedAttempts += 1;
    localStorage.setItem('failedAttempts', String(failedAttempts));

    if (failedAttempts >= 3) {
      forgotPasswordLink.style.display = 'block';
    }
  }
});

window.addEventListener('beforeunload', clearExpiredPreview);