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
function getTodayCRParts() {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const [year, month, day] = todayStr.split('-').map(Number);
  return { year, month, day };
}
function isDateInCurrentMonthCR(dateStr) {
  const { year: cy, month: cm } = getTodayCRParts();
  const [y, m] = dateStr.split('-').map(Number);
  return y === cy && m === cm;
}
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
  // ─── Sidebar toggle ───────────────────────────────────────────────────
  const toggleBtn = document.getElementById("toggleNav");
  const sidebar   = document.getElementById("sidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }

  // ─── Logout desde sidebar ─────────────────────────────────────────────
  const logoutSidebar = document.getElementById("logoutSidebar");
  if (logoutSidebar) {
    logoutSidebar.addEventListener("click", async (e) => {
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

  // ─── Seguridad y resto de la lógica ──────────────────────────────────
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = './index.html';
      return;
    }

    // 0) Bloqueo si mensualidad vencida
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
    const uSnap = await getDoc(doc(db, 'users', user.uid));
    const exp   = uSnap.exists() ? uSnap.data().expiryDate : null;
    const calEl = document.getElementById('calendar');
    if (!exp || exp < today) {
      showAlert('Tu mensualidad ha vencido. Contacta al admin.', 'error');
      if (calEl) {
        calEl.style.pointerEvents = 'none';
        calEl.style.opacity       = '0.4';
      }
      return;
    }

    // 1) Mostrar código de asistencia
    const codeEl = document.getElementById('attendanceCodeDisplay');
    if (codeEl) {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const code     = userSnap.exists() ? userSnap.data().attendanceCode || '—' : '—';
        codeEl.textContent = `Tu código de asistencia: ${code}`;
      } catch (err) {
        console.error(err);
        codeEl.textContent = 'Error al cargar el código.';
      }
    }

    // 2) Reloj local de Costa Rica
    const localTimeEl = document.getElementById('local-time');
    if (localTimeEl) {
      const fmt = new Intl.DateTimeFormat('es-CR', {
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: true, timeZone: 'America/Costa_Rica'
      });
      function updateLocalTime() {
        localTimeEl.textContent = `Hora en Costa Rica: ${fmt.format(new Date())}`;
      }
      updateLocalTime();
      setInterval(updateLocalTime, 1000);
    }

    // 3) Inicializar FullCalendar
    calendar = new FullCalendar.Calendar(calEl, {
      locale: 'es',
      initialView: 'dayGridMonth',
      timeZone: 'America/Costa_Rica',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek,dayGridDay'
      },
      events(info, success, failure) {
        const q = query(
          collection(db, 'reservations'),
          where('date', '>=', info.startStr),
          where('date', '<=', info.endStr)
        );
        onSnapshot(q, snap => {
          const evs = snap.docs
            .filter(d => !d.data().user || d.data().user === auth.currentUser.email)
            .map(d => {
              const r = d.data();
              return {
                title: `Clase MMA - ${r.time}`,
                start: `${r.date}T${r.time}:00`,
                allDay: false,
                id: d.id
              };
            });
          success(evs);
        }, err => {
          console.error(err);
          failure(err);
        });
      },
      eventContent() {
        return { html: '<div style="font-size:20px;color:green;text-align:center;">✔️</div>' };
      },
      dateClick(info) {
        const dateStr = info.dateStr;
        const dow     = info.date.getUTCDay();
        if (!isDateInCurrentMonthCR(dateStr)) {
          showAlert('Solo puedes reservar en el mes actual.', 'error');
          return;
        }
        if (dow !== 5 && dow !== 6) {
          showAlert('Solo viernes y sábados.', 'error');
          return;
        }
        if (!isDateNotPastCR(dateStr)) {
          showAlert('No puedes reservar fechas pasadas.', 'error');
          return;
        }
        const time = dow === 5 ? '20:30' : '09:00';
        checkExistingReservation(dateStr, time).then(exists => {
          if (exists) {
            showAlert(`Ya tienes reserva el ${new Date(dateStr).toLocaleDateString('es-CR')} a las ${time}.`, 'error');
          } else {
            openConfirmReservationModal(dateStr, time);
          }
        }).catch(err => {
          console.error(err);
          showAlert('Error verificando reserva.', 'error');
        });
      },
      eventClick(info) {
        const [d, t] = info.event.startStr.split('T');
        openDeleteReservationModal(info.event.id, d, t.slice(0,5));
      },
      dayCellClassNames(arg) {
        const d = arg.date.getUTCDay();
        return (d !== 5 && d !== 6) ? ['disabled-day'] : [];
      }
    });

    calendar.render();
  });
});

// ─── Funciones de reserva ─────────────────────────────────────────────────
async function checkExistingReservation(date, time) {
  const q = query(
    collection(db, 'reservations'),
    where('date','==',date),
    where('time','==',time),
    where('user','==',auth.currentUser.email)
  );
  const snap = await getDocs(q);
  return snap.docs.length > 0;
}

async function addReservation(date, time) {
  try {
    const qUsers = query(
      collection(db, 'users'),
      where('correo','==',auth.currentUser.email.toLowerCase())
    );
    const uSnap = await getDocs(qUsers);
    if (uSnap.empty) {
      showAlert('Perfil no encontrado.', 'error');
      return;
    }
    const u = uSnap.docs[0].data();
    await addDoc(collection(db,'reservations'), {
      date, time, user: auth.currentUser.email, nombre: u.nombre
    });
    await setDoc(doc(db,'asistencias',date), { creadaEl: Date.now() }, { merge: true });
    await setDoc(doc(db,'asistencias',date,'usuarios',auth.currentUser.uid), {
      nombre: u.nombre, hora: time, presente: false
    });
  } catch (err) {
    console.error(err);
    showAlert('Error guardando reserva.', 'error');
    throw err;
  }
}

async function deleteReservation(resId) {
  try {
    const ref    = doc(db,'reservations',resId);
    const snap   = await getDoc(ref);
    if (snap.exists()) {
      const { date } = snap.data();
      await deleteDoc(doc(db,'asistencias',date,'usuarios',auth.currentUser.uid));
    }
    await deleteDoc(ref);
  } catch (err) {
    console.error(err);
    showAlert('Error eliminando reserva.', 'error');
  }
}

// ─── Modales ─────────────────────────────────────────────────────────────
function openConfirmReservationModal(date, time) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <p>¿Confirmar reserva para el ${date} a las ${time}?</p>
      <button id="confirmBtn" class="btn">Confirmar</button>
      <button id="cancelBtn"  class="btn error">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('confirmBtn').onclick = async () => {
    try {
      const qUsers = query(
        collection(db,'users'),
        where('correo','==',auth.currentUser.email.toLowerCase())
      );
      const uSnap = await getDocs(qUsers);
      if (uSnap.empty) {
        showAlert('Usuario no encontrado.', 'error');
        closeModal();
        return;
      }
      if (!uSnap.docs[0].data().autorizado) {
        showAlert('No autorizado.', 'error');
        closeModal();
        return;
      }
      await addReservation(date, time);
      showAlert('Reserva confirmada', 'success');
      calendar.refetchEvents();
    } catch {
      showAlert('Error confirmando reserva.', 'error');
    } finally {
      closeModal();
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
      <p>¿Eliminar reserva del ${date} a las ${time}?</p>
      <button id="deleteBtn" class="btn error">Eliminar</button>
      <button id="cancelDeleteBtn" class="btn">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('deleteBtn').onclick = async () => {
    try {
      await deleteReservation(resId);
      showAlert('Reserva eliminada', 'success');
      calendar.refetchEvents();
    } catch {
      showAlert('Error eliminando reserva.', 'error');
    } finally {
      closeModal();
    }
  };
  document.getElementById('cancelDeleteBtn').onclick = closeModal;
}

function closeModal() {
  const m = document.querySelector('.custom-modal');
  if (m) m.remove();
}

// ─── Logout desde el botón rojo ─────────────────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      showAlert("Has cerrado sesión", 'success');
      setTimeout(() => window.location.href = "index.html", 1000);
    } catch {
      showAlert("Error al cerrar sesión", 'error');
    }
  });
}
