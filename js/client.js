// ./js/client.js

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  deleteDoc,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

let calendar;

// ─── Helpers para manejar fechas en hora de Costa Rica ───────────────────

/**
 * Devuelve un objeto {year, month, day} con la fecha actual en CR.
 */
function getTodayCRParts() {
  const todayStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Costa_Rica'
  });             // "YYYY-MM-DD"
  const [year, month, day] = todayStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Retorna true si dateStr pertenece al mismo mes y año que hoy en CR.
 * dateStr debe estar en formato "YYYY-MM-DD".
 */
function isDateInCurrentMonthCR(dateStr) {
  const { year: cy, month: cm } = getTodayCRParts();
  const [y, m] = dateStr.split('-').map(Number);
  return y === cy && m === cm;
}

/**
 * Retorna true si dateStr no es anterior al día actual en CR.
 */
function isDateNotPastCR(dateStr) {
  const { year: cy, month: cm, day: cd } = getTodayCRParts();
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y < cy) return false;
  if (y > cy) return true;
  if (m < cm) return false;
  if (m > cm) return true;
  return d >= cd;
}

document.addEventListener('DOMContentLoaded', () => {
  // ─── Mostrar código de asistencia debajo del título ───────────────────────
  onAuthStateChanged(auth, async user => {
    const codeEl = document.getElementById('attendanceCodeDisplay');
    if (user && codeEl) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const code = userSnap.data().attendanceCode || '—';
          codeEl.textContent = `Tu código de asistencia: ${code}`;
        } else {
          codeEl.textContent = 'Código de asistencia no encontrado.';
        }
      } catch (err) {
        console.error('Error al obtener código de asistencia:', err);
        codeEl.textContent = 'Error al cargar el código.';
      }
    }
  });

  // ─── Reloj local de Costa Rica ────────────────────────────────────────────
  const localTimeEl = document.getElementById('local-time');
  if (localTimeEl) {
    const fmt = new Intl.DateTimeFormat('es-CR', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
      timeZone: 'America/Costa_Rica'
    });
    function updateLocalTime() {
      localTimeEl.textContent = `Hora en Costa Rica: ${fmt.format(new Date())}`;
    }
    updateLocalTime();
    setInterval(updateLocalTime, 1000);
  }

  // ─── Inicializar FullCalendar con zona CR ─────────────────────────────────
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    timeZone: 'America/Costa_Rica',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,dayGridDay'
    },
    events(info, successCallback, failureCallback) {
      const q = query(
        collection(db, 'reservations'),
        where('date', '>=', info.startStr),
        where('date', '<=', info.endStr)
      );
      onSnapshot(q, snap => {
        const events = snap.docs
          .filter(d => !d.data().user || d.data().user === auth.currentUser.email)
          .map(d => {
            const r = d.data();
            return {
              title: `Clase MMA - ${r.time}`,
              start: `${r.date}T${r.time}:00`,
              allDay: false,
              id: d.id,
            };
          });
        successCallback(events);
      }, err => {
        console.error('Error al obtener reservas:', err);
        failureCallback(err);
      });
    },
    eventContent() {
      return { html: '<div style="font-size:20px;color:green;text-align:center;">✔️</div>' };
    },
    dateClick(info) {
      const dateStr     = info.dateStr;
      const dayOfWeekCR = info.date.getUTCDay();

      // 1) Solo mes/año actual
      if (!isDateInCurrentMonthCR(dateStr)) {
        showAlert('Solo puedes reservar dentro del mes actual.', 'error');
        return;
      }
      // 2) Solo viernes (5) o sábado (6)
      if (dayOfWeekCR !== 5 && dayOfWeekCR !== 6) {
        showAlert('Solo puedes reservar clases los viernes y sábados.', 'error');
        return;
      }
      // 3) No fechas pasadas
      if (!isDateNotPastCR(dateStr)) {
        showAlert('No puedes reservar una fecha anterior a hoy.', 'error');
        return;
      }

      // 4) Abrir modal con hora adecuada
      const time = dayOfWeekCR === 5 ? '20:30' : '09:00';
      checkExistingReservation(dateStr, time)
        .then(exists => {
          if (exists) {
            showAlert(
              `Ya tienes una reserva para el ${new Date(dateStr).toLocaleDateString('es-CR')} a las ${time}.`,
              'error'
            );
          } else {
            openConfirmReservationModal(dateStr, time);
          }
        })
        .catch(err => {
          console.error('Error al verificar reserva:', err);
          showAlert('Error al verificar reserva.', 'error');
        });
    },
    eventClick(info) {
      const [d, t] = info.event.startStr.split('T');
      openDeleteReservationModal(info.event.id, d, t.slice(0,5));
    },
    dayCellClassNames(arg) {
      const d = arg.date.getUTCDay();
      if (d !== 5 && d !== 6) return ['disabled-day'];
    }
  });

  calendar.render();
});

// ─── Lógica de reservas ─────────────────────────────────────────────────────

async function checkExistingReservation(date, time) {
  const q = query(
    collection(db, 'reservations'),
    where('date', '==', date),
    where('time', '==', time),
    where('user', '==', auth.currentUser.email)
  );
  const snap = await getDocs(q);
  return snap.docs.length > 0;
}

async function addReservation(date, time) {
  try {
    const qUsers = query(
      collection(db, 'users'),
      where('correo', '==', auth.currentUser.email.toLowerCase())
    );
    const usersSnap = await getDocs(qUsers);
    if (usersSnap.empty) {
      showAlert('No se encontró el perfil del usuario.', 'error');
      return;
    }
    const u = usersSnap.docs[0].data();
    await addDoc(collection(db, 'reservations'), {
      date, time, user: auth.currentUser.email, nombre: u.nombre
    });
    await setDoc(doc(db, 'asistencias', date), { creadaEl: Date.now() }, { merge: true });
    await setDoc(doc(db, 'asistencias', date, 'usuarios', auth.currentUser.uid), {
      nombre: u.nombre, hora: time, presente: false
    });
  } catch (err) {
    console.error("Error al agregar reserva:", err);
    showAlert("Error al guardar la reserva.", 'error');
    throw err;
  }
}

async function deleteReservation(resId) {
  try {
    const resRef = doc(db, 'reservations', resId);
    const resSnap = await getDoc(resRef);
    if (resSnap.exists()) {
      const { date } = resSnap.data();
      await deleteDoc(doc(db, 'asistencias', date, 'usuarios', auth.currentUser.uid));
    }
    await deleteDoc(resRef);
  } catch (err) {
    console.error("Error al eliminar reserva:", err);
    showAlert("Error al eliminar reserva.", 'error');
  }
}

// ─── Modales de confirmación ───────────────────────────────────────────────

function openConfirmReservationModal(date, time) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <p>¿Confirmar reserva para el ${date} a las ${time}?</p>
      <button id="confirmBtn">Confirmar</button>
      <button id="cancelBtn">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('confirmBtn').onclick = async () => {
    try {
      const qUsers = query(
        collection(db,'users'),
        where('correo','==', auth.currentUser.email.toLowerCase())
      );
      const usersSnap = await getDocs(qUsers);
      if (usersSnap.empty) {
        showAlert('Usuario no encontrado.', 'error');
        closeModal();
        return;
      }
      if (!usersSnap.docs[0].data().autorizado) {
        showAlert('No autorizado.', 'error');
        closeModal();
        return;
      }
      await addReservation(date, time);
      showAlert('Reserva confirmada','success');
      closeModal();
      calendar.refetchEvents();
    } catch (err) {
      console.error('Error al confirmar reserva:', err);
      showAlert('Error al confirmar reserva.','error');
    }
  };
  document.getElementById('cancelBtn').onclick = closeModal;
}

function openDeleteReservationModal(resId, date, time) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <p>¿Eliminar reserva para el ${date} a las ${time}?</p>
      <button id="deleteBtn">Eliminar</button>
      <button id="cancelDeleteBtn">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('deleteBtn').onclick = async () => {
    try {
      await deleteReservation(resId);
      showAlert('Reserva eliminada','success');
      closeModal();
      calendar.refetchEvents();
    } catch {
      showAlert('Error al eliminar reserva.','error');
    }
  };
  document.getElementById('cancelDeleteBtn').onclick = closeModal;
}

function closeModal() {
  const m = document.querySelector('.custom-modal');
  if (m) m.remove();
}

// ─── Logout desde client-dashboard.html ───────────────────────────────────

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      showAlert("Has cerrado sesión",'success');
      setTimeout(() => window.location.href="index.html",1500);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      showAlert('Error al cerrar sesión.','error');
    }
  });
}
