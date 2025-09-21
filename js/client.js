// ./js/client.js — reservas sin duplicados + loader + iOS friendly
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  query,
  where,
  deleteDoc,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

let calendar;

/* ========== Loader global ========== */
function ensureLoader() {
  if (document.getElementById('global-loader')) return;
  const el = document.createElement('div');
  el.id = 'global-loader';
  el.style.cssText = `
    position:fixed; inset:0; display:none; place-items:center;
    background:rgba(0,0,0,.35); z-index:9999; backdrop-filter:blur(1.5px)
  `;
  el.innerHTML = `
    <div style="
      width:64px;height:64px;border-radius:50%;
      border:6px solid rgba(255,255,255,.25);
      border-top-color:#58a6ff; animation:spin 1s linear infinite">
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(el);
}
function showLoader(){ ensureLoader(); document.getElementById('global-loader').style.display='grid'; }
function hideLoader(){ const el=document.getElementById('global-loader'); if(el) el.style.display='none'; }
window.showLoader = showLoader;
window.hideLoader = hideLoader;

/* ========== Helpers fecha (CR) ========== */
function getTodayCRParts() {
  const s = new Date().toLocaleDateString('en-CA',{ timeZone:'America/Costa_Rica' });
  const [y,m,d] = s.split('-').map(Number);
  return { year:y, month:m, day:d };
}
function isDateInCurrentMonthCR(dateStr){
  const {year:cy,month:cm}=getTodayCRParts();
  const [y,m]=dateStr.split('-').map(Number);
  return y===cy && m===cm;
}
function isDateNotPastCR(dateStr){
  const {year:cy,month:cm,day:cd}=getTodayCRParts();
  const [y,m,d]=dateStr.split('-').map(Number);
  if(y<cy) return false; if(y>cy) return true;
  if(m<cm) return false; if(m>cm) return true;
  return d>=cd;
}

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar
  const toggleBtn = document.getElementById("toggleNav");
  const sidebar   = document.getElementById("sidebar");
  if (toggleBtn && sidebar) toggleBtn.addEventListener("click", () => sidebar.classList.toggle("active"));

  // Logout (sidebar)
  const logoutSidebar = document.getElementById("logoutSidebar");
  if (logoutSidebar) {
    logoutSidebar.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert("Has cerrado sesión", "success");
        setTimeout(()=>location.href="index.html", 900);
      } catch {
        showAlert("Error al cerrar sesión", "error");
      }
    });
  }

  // Seguridad + calendario
  onAuthStateChanged(auth, async user => {
    if (!user) { location.href='./index.html'; return; }

    // Código de asistencia
    const codeEl = document.getElementById('attendanceCodeDisplay');
    if (codeEl) {
      try {
        const snap = await getDoc(doc(db,'users',user.uid));
        codeEl.textContent = `Tu código de asistencia: ${snap.exists() ? (snap.data().attendanceCode || '—') : '—'}`;
      } catch (e) { console.error(e); codeEl.textContent='Error al cargar el código.'; }
    }

    // Reloj CR
    const localTimeEl = document.getElementById('local-time');
    if (localTimeEl) {
      const fmt = new Intl.DateTimeFormat('es-CR',{hour:'numeric',minute:'numeric',second:'numeric',hour12:true,timeZone:'America/Costa_Rica'});
      const tick=()=>localTimeEl.textContent=`Hora en Costa Rica: ${fmt.format(new Date())}`;
      tick(); setInterval(tick,1000);
    }

    // FullCalendar
    const calEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calEl, {
      locale:'es',
      initialView:'',
      timeZone:'America/Costa_Rica',
      headerToolbar:{ left:'', center:'title', right:'' },

      // 🔁 Carga reactiva desde Firestore con limpieza de eventos optimistas
      events(info, success, failure){
        const myQ = query(collection(db,'reservations'), where('user','==', auth.currentUser.email));
        const unsub = onSnapshot(myQ, snap=>{
          try{
            const evs = snap.docs.map(d => {
              const r = d.data();
              return {
                id: d.id,
                title: `Clase MMA - ${r.time}`,
                start: `${r.date}T${r.time}:00`,
                allDay: false
              };
            }).filter(e => e.start >= `${info.startStr}T00:00:00` && e.start <= `${info.endStr}T23:59:59`);

            // 🧹 Si hay eventos optimistas (temp:true) con el mismo id, elimínalos
            if (calendar) {
              for (const e of evs) {
                const existing = calendar.getEventById(e.id);
                if (existing?.extendedProps?.temp === true) existing.remove();
              }
            }

            success(evs);
          }catch(e){ console.error(e); failure(e); }
        }, err => { console.error(err); failure(err); });

        return () => unsub && unsub();
      },

      eventContent(){ return { html:'<div style="font-size:20px;color:green;text-align:center;">✅</div>' }; },

      dateClick(info){
        const dateStr = info.dateStr;
        const dow = info.date.getUTCDay(); // 5=vie, 6=sáb
        if(!isDateInCurrentMonthCR(dateStr)){ showAlert('Solo puedes reservar en el mes actual.','error'); return; }
        if(dow!==5 && dow!==6){ showAlert('Solo viernes y sábados.','error'); return; }
        if(!isDateNotPastCR(dateStr)){ showAlert('No puedes reservar fechas pasadas.','error'); return; }
        const time = (dow===5) ? '20:30' : '09:00';
        openConfirmReservationModal(dateStr, time);
      },

      eventClick(info){
        const [d,t]=info.event.startStr.split('T');
        openDeleteReservationModal(info.event.id, d, t.slice(0,5));
      },

      dayCellClassNames(arg){ const d=arg.date.getUTCDay(); return (d!==5 && d!==6) ? ['disabled-day'] : []; }
    });

    calendar.render();
  });
});

/* ========== CRUD de reservas ========== */
async function addReservation(date, time) {
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) { showAlert('Perfil no encontrado.', 'error'); return null; }
    const u = userDoc.data();

    const docRef = await addDoc(collection(db,'reservations'), {
      date,
      time,
      userId: auth.currentUser.uid,
      user: auth.currentUser.email,
      nombre: u.nombre
    });

    // preparar asistencia del día
    await setDoc(doc(db,'asistencias',date), { creadaEl: Date.now() }, { merge: true });
    await setDoc(doc(db,'asistencias',date,'usuarios',auth.currentUser.uid), {
      nombre: u.nombre, hora: time, presente: false
    });

    return docRef.id;
  } catch (err) {
    console.error(err);
    showAlert('Error guardando reserva.', 'error');
    throw err;
  }
}

async function deleteReservation(resId) {
  try {
    showLoader();

    // Quita de calendario inmediatamente (UI optimista)
    calendar?.getEventById(resId)?.remove();

    const ref  = doc(db,'reservations',resId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const { date } = snap.data();
      await deleteDoc(doc(db,'asistencias',date,'usuarios',auth.currentUser.uid));
    }
    await deleteDoc(ref);

    setTimeout(() => calendar?.refetchEvents(), 200);
  } catch (err) {
    console.error(err);
    showAlert('Error eliminando reserva.', 'error');
    setTimeout(() => calendar?.refetchEvents(), 300);
  } finally {
    hideLoader();
  }
}

/* ========== Modales ========== */
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
      showLoader();

      // Autorización
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) { showAlert('Usuario no encontrado.', 'error'); return; }
      if (!userDoc.data().autorizado) { showAlert('No autorizado.❌', 'error'); return; }

      // CREA reserva y recibe el id
      const newId = await addReservation(date, time);
      if (!newId) return;

      // ✅ UI OPTIMISTA: añade el evento local marcado como temporal
      if (!calendar.getEventById(newId)) {
        calendar.addEvent({
          id: newId,
          title: `Clase MMA - ${time}`,
          start: `${date}T${time}:00`,
          allDay: false,
          extendedProps: { temp: true }
        });
      }

      showAlert('Reserva confirmada 👍', 'success');

      // Refetch por seguridad si el snapshot tarda
      setTimeout(() => calendar?.refetchEvents(), 300);

    } catch (e) {
      console.error(e);
      showAlert('❗Error confirmando reserva.❗', 'error');
    } finally {
      hideLoader();
      closeModal();
    }
  };

  document.getElementById('cancelBtn').onclick = closeModal;
}

function openDeleteReservationModal(resId, date, time){
  closeModal();
  const m = document.createElement('div');
  m.className='custom-modal';
  m.innerHTML=`
    <div class="modal-content">
      <p>¿Eliminar reserva del ${date} a las ${time}?</p>
      <button id="deleteBtn" class="btn error">Eliminar</button>
      <button id="cancelDeleteBtn" class="btn">Cancelar</button>
    </div>`;
  document.body.appendChild(m);

  document.getElementById('deleteBtn').onclick = async () => {
    try { await deleteReservation(resId); }
    catch { showAlert('Error eliminando reserva.','error'); }
    finally { closeModal(); }
  };
  document.getElementById('cancelDeleteBtn').onclick = closeModal;
}

function closeModal(){ const m=document.querySelector('.custom-modal'); if(m) m.remove(); }

/* ========== Logout botón rojo (si existe) ========== */
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      showAlert('Has cerrado sesión','success');
      setTimeout(()=>location.href='index.html',900);
    } catch { showAlert('Error al cerrar sesión','error'); }
  });
}
