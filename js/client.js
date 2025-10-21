// ./js/client.js — Cliente (estudiante / profesor)
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, getDocs, getDoc, addDoc, doc, query, where, deleteDoc,
  onSnapshot, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ───────────────── Estado global ───────────────── */
let calStudent = null;
let calStaff   = null;
let unsubStudent = null;
let unsubStaff   = null;

/* ───────── Navbar: CSS fallback + “bind once” para evitar duplicados ───────── */
function ensureNavCSS(){
  if (document.getElementById('nav-fallback-css')) return;
  const style = document.createElement('style');
  style.id = 'nav-fallback-css';
  style.textContent = `
    .hamburger-btn{position:fixed;right:16px;top:16px;z-index:10001}
    .sidebar{position:fixed;inset:0 auto 0 0;width:260px;height:100vh;background:#0c131a;
             border-right:1px solid #22303d;transform:translateX(-100%);transition:transform .25s ease;z-index:10000}
    .sidebar.active{transform:translateX(0)}
    .sidebar ul{list-style:none;margin:0;padding:14px}
    .sidebar a{display:flex;gap:.5rem;align-items:center;padding:10px;border-radius:10px;
               color:#e5e7eb;text-decoration:none}
    .sidebar a:hover{background:#111827}
  `;
  document.head.appendChild(style);
}
function bindSidebarOnce(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (!btn || !sb || btn.dataset.bound) return;
  btn.addEventListener('click', ()=> sb.classList.toggle('active'));
  btn.dataset.bound = '1';
}
function bindLogoutOnce(){
  const a = document.getElementById('logoutSidebar');
  if (!a || a.dataset.bound) return;
  a.addEventListener('click', async (e)=>{
    e.preventDefault();
    try { await signOut(auth); showAlert('Has cerrado sesión','success'); setTimeout(()=>location.href='index.html',900); }
    catch { showAlert('Error al cerrar sesión','error'); }
  });
  a.dataset.bound = '1';
}

/* ───────── Loader simple ───────── */
function ensureLoader(){
  if (document.getElementById('global-loader')) return;
  const el = document.createElement('div');
  el.id = 'global-loader';
  el.style.cssText = `
    position:fixed; inset:0; display:none; place-items:center;
    background:rgba(0,0,0,.35); z-index:9999; backdrop-filter:blur(1.5px)
  `;
  el.innerHTML = `
    <div style="width:64px;height:64px;border-radius:50%;
      border:6px solid rgba(255,255,255,.25);border-top-color:#58a6ff;animation:spin 1s linear infinite">
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(el);
}
function showLoader(){ ensureLoader(); document.getElementById('global-loader').style.display='grid'; }
function hideLoader(){ const el=document.getElementById('global-loader'); if(el) el.style.display='none'; }

/* ───────── CSS afinado calendario y modal ───────── */
(function injectCSS(){
  if (document.getElementById('client-extras-css')) return;
  const s = document.createElement('style');
  s.id = 'client-extras-css';
  s.textContent = `
    .fc, #calendarStudent, #calendarProf{ -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    .fc-daygrid-event .fc-event-title{ font-weight:800; }

    /* Modal de asistencia (profesor) */
    #attModal{ position:fixed; inset:0; display:none; place-items:center; z-index:10000; background:rgba(0,0,0,.45); }
    #attModal.active{ display:grid; }
    #attModal .att-card{ width:min(92vw,520px); background:#0c131a; border:1px solid #22303d; border-radius:14px; padding:14px; box-shadow:0 12px 28px rgba(0,0,0,.35); }
    #attModal .att-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
    #attModal .att-list{ display:grid; gap:8px; max-height:50vh; overflow:auto; padding-right:4px; }
    #attModal .att-item{ display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid #233140; border-radius:10px; background:#0f1720; }
    #attModal .close-btn{ padding:8px 12px; border-radius:10px; background:#1f2937; border:1px solid #334155; color:#e5e7eb; cursor:pointer; }

    .custom-tooltip{position:fixed; z-index:10001; background:#0b2540; color:#b4d7ff; border:1px solid #1e3a5f; padding:6px 8px; border-radius:8px; pointer-events:none;}
    .disabled-day{ filter:grayscale(.45) opacity(.7); }
  `;
  document.head.appendChild(s);
})();

/* ───────── Modal asistencia (inyectado) ───────── */
function ensureAttendancePopup(){
  if (document.getElementById('attModal')) return;
  const m = document.createElement('div');
  m.id = 'attModal';
  m.innerHTML = `
    <div class="att-card">
      <div class="att-head">
        <h3 id="attDate" style="margin:0;font-weight:800;">—</h3>
        <button id="attClose" class="close-btn">Cerrar</button>
      </div>
      <div id="attList" class="att-list"></div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#attClose').onclick = () => { m.classList.remove('active'); killTooltips(); };
}
function killTooltips(){ document.querySelectorAll('.custom-tooltip').forEach(el => el.remove()); }

/* ───────── Helpers horarios CR + reglas de reserva/cancelación ───────── */
const CR_TZ = 'America/Costa_Rica';
const CR_OFFSET = '-06:00';

function getTodayCRParts(){
  const s = new Date().toLocaleDateString('en-CA',{ timeZone: CR_TZ });
  const [y,m,d] = s.split('-').map(Number);
  return {year:y, month:m, day:d};
}
function isDateInCurrentMonthCR(dateStr){
  const {year:cy,month:cm}=getTodayCRParts();
  const [y,m]=dateStr.split('-').map(Number);
  return y===cy && m===cm;
}
function nowCRString(){
  const d = new Intl.DateTimeFormat('en-CA',{ timeZone: CR_TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  const t = new Intl.DateTimeFormat('en-GB',{ timeZone: CR_TZ, hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date());
  return { date:d, time:t };
}
function crDateTime(dateStr, timeStr){ return new Date(`${dateStr}T${timeStr}:00${CR_OFFSET}`); }
function canBook(dateStr, timeStr){
  const {date:today, time:nowT} = nowCRString();
  const now  = crDateTime(today, nowT);
  const slot = crDateTime(dateStr, timeStr);
  const diffMs = slot - now;
  if (diffMs <= 0) return { ok:false, reason:'during_or_after' };
  if (dateStr === today && diffMs < 60*60*1000) return { ok:false, reason:'lt1h' };
  return { ok:true };
}
function canCancel(dateStr, timeStr){
  const {date:today, time:nowT} = nowCRString();
  const now  = crDateTime(today, nowT);
  const slot = crDateTime(dateStr, timeStr);
  return (slot - now) > 0;
}

/* ───────── Calendario Estudiante ───────── */
function buildStudentCalendar(holderEl){
  if (!holderEl) return;
  if (unsubStudent){ try{unsubStudent();}catch{} unsubStudent=null; }
  if (calStudent){ try{calStudent.destroy();}catch{} calStudent=null; }
  holderEl.innerHTML='';

  calStudent = new FullCalendar.Calendar(holderEl, {
    locale:'es',
    initialView:'dayGridMonth',
    timeZone: CR_TZ,
    headerToolbar:{ left:'', center:'title', right:'' },
    height:'auto', contentHeight:'auto', expandRows:true, handleWindowResize:true,

    events(info, success, failure){
      const myQ = query(collection(db,'reservations'), where('user','==', auth.currentUser.email));
      unsubStudent = onSnapshot(myQ, snap=>{
        try{
          const evs = snap.docs.map(d=>{
            const r=d.data();
            return { id:d.id, title:`Clase MMA - ${r.time}`, start:`${r.date}T${r.time}:00`, allDay:false };
          }).filter(e => e.start >= `${info.startStr}T00:00:00` && e.start <= `${info.endStr}T23:59:59`);
          success(evs);
        }catch(err){ console.error(err); failure(err); }
      }, err=>{ console.error(err); failure(err); });
      return () => unsubStudent && unsubStudent();
    },

    eventContent(){ return { html:'<div style="font-size:20px;color:green;text-align:center;">✅</div>' }; },

    dateClick(info){
      const dateStr = info.dateStr;
      const dow = info.date.getUTCDay(); // 5=viernes, 6=sábado
      if(!isDateInCurrentMonthCR(dateStr)){ showAlert('Solo puedes reservar en el mes actual.','error'); return; }
      if(dow!==5 && dow!==6){ showAlert('Solo viernes y sábados.','error'); return; }

      const classTime = (dow===5) ? '20:30' : '09:00';
      const check = canBook(dateStr, classTime);
      if (!check.ok){
        showAlert(check.reason==='lt1h' ? 'Para hoy solo puedes reservar hasta 1 hora antes.' : 'No puedes reservar durante o después de la clase.', 'error');
        return;
      }
      openConfirmReservationModal(dateStr, classTime);
    },

    eventClick(info){
      const [d,t] = info.event.startStr.split('T');
      const time  = (t||'').slice(0,5);
      if (!canCancel(d, time)){ showAlert('No puedes cancelar durante o después de la clase.','error'); return; }
      openDeleteReservationModal(info.event.id, d, time);
    },

    dayCellClassNames(arg){ const d=arg.date.getUTCDay(); return (d!==5 && d!==6) ? ['disabled-day'] : []; }
  });

  requestAnimationFrame(()=>{ calStudent.render(); setTimeout(()=>calStudent.updateSize(), 40); });
}

/* ───────── Calendario Profesor (conteo + popup) ───────── */
function buildStaffCalendar(holderEl){
  if (!holderEl) return;
  ensureAttendancePopup();

  if (unsubStaff){ try{unsubStaff();}catch{} unsubStaff=null; }
  if (calStaff){ try{calStaff.destroy();}catch{} calStaff=null; }
  holderEl.innerHTML='';

  calStaff = new FullCalendar.Calendar(holderEl, {
    locale:'es',
    initialView:'dayGridMonth',
    timeZone: CR_TZ,
    headerToolbar:{ left:'', center:'title', right:'' },
    height:'auto', contentHeight:'auto', expandRows:true, handleWindowResize:true,

    events(info, success, failure){
      const qAll = query(collection(db,'reservations')); // requiere rol 'professor' o 'admin' por reglas
      unsubStaff = onSnapshot(qAll, snap=>{
        try{
          const byDate = {};
          snap.forEach(d=>{
            const data = d.data();
            if (!data.date) return;
            byDate[data.date] ??= [];
            byDate[data.date].push(data.nombre || 'Desconocido');
          });
          const list = Object.entries(byDate).map(([date, names]) => ({
            title: `${names.length}`,
            start: date,
            allDay: true,
            extendedProps: { names, count:names.length }
          })).filter(e => e.start >= info.startStr && e.start <= info.endStr);
          success(list);
        }catch(err){ console.error(err); failure(err); }
      }, err=>{ console.error(err); failure(err); });
      return () => unsubStaff && unsubStaff();
    },

    eventMouseEnter: info => {
      const modalActive = document.getElementById('attModal')?.classList.contains('active');
      if (modalActive) return;
      const tip = document.createElement('div');
      tip.className = 'custom-tooltip';
      tip.innerHTML = `<strong>Usuarios:</strong><br>${(info.event.extendedProps.names||[]).join('<br>')}`;
      document.body.appendChild(tip);
      const move = e => { tip.style.left = `${e.pageX+10}px`; tip.style.top = `${e.pageY+10}px`; };
      const cleanup = () => tip.remove();
      info.el.addEventListener('mousemove', move);
      info.el.addEventListener('mouseleave', cleanup);
      info.el.addEventListener('click', cleanup);
    },

    eventClick: async info => {
      killTooltips();
      const day = info.event.startStr;
      const list = await getReservasPorDia(day);
      openAttendancePopup(list, day);
    },

    dayCellClassNames(arg){ const d=arg.date.getUTCDay(); return (d!==5 && d!==6) ? ['disabled-day'] : []; }
  });

  requestAnimationFrame(()=>{ calStaff.render(); setTimeout(()=>calStaff.updateSize(), 40); });
}

/* ───────── CRUD de reservas (estudiante) ───────── */
async function addReservation(date, time){
  try{
    const userRef = doc(db,'users', auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()){ showAlert('Perfil no encontrado.','error'); return null; }
    const u = userDoc.data();

    const docRef = await addDoc(collection(db,'reservations'), {
      date, time,
      userId: auth.currentUser.uid,
      user: auth.currentUser.email,
      nombre: u.nombre
    });

    await setDoc(doc(db,'asistencias',date), { creadaEl: Date.now() }, { merge:true });
    await setDoc(doc(db,'asistencias',date,'usuarios',auth.currentUser.uid), {
      nombre: u.nombre, hora: time, presente:false
    });

    return docRef.id;
  }catch(err){
    console.error(err);
    showAlert('Error guardando reserva.','error');
    throw err;
  }
}
async function deleteReservation(resId){
  try{
    showLoader();
    calStudent?.getEventById(resId)?.remove();
    const ref  = doc(db,'reservations',resId);
    const snap = await getDoc(ref);
    if (snap.exists()){
      const { date } = snap.data();
      await deleteDoc(doc(db,'asistencias',date,'usuarios',auth.currentUser.uid));
    }
    await deleteDoc(ref);
    showAlert('Reserva eliminada','success');
    setTimeout(()=> calStudent?.refetchEvents(), 150);
  }catch(err){
    console.error(err);
    showAlert('Error eliminando reserva.','error');
    setTimeout(()=> calStudent?.refetchEvents(), 250);
  }finally{ hideLoader(); }
}

/* ───────── Modales (estudiante) ───────── */
function openConfirmReservationModal(date, time){
  closeModal();
  const m = document.createElement('div'); m.className='custom-modal';
  m.innerHTML = `
    <div class="modal-content">
      <p>¿Confirmar reserva para el ${date} a las ${time}?</p>
      <button id="confirmBtn" class="btn">Confirmar</button>
      <button id="cancelBtn"  class="btn error">Cancelar</button>
    </div>`;
  document.body.appendChild(m);

  document.getElementById('confirmBtn').onclick = async () => {
    try{
      const check = canBook(date, time);
      if (!check.ok){
        showAlert(check.reason==='lt1h' ? 'Para hoy solo puedes reservar hasta 1 hora antes.' : 'No puedes reservar durante o después de la clase.', 'error');
        return;
      }
      showLoader();
      const udoc = await getDoc(doc(db,'users',auth.currentUser.uid));
      if(!udoc.exists()){ showAlert('Usuario no encontrado.','error'); return; }
      if(!udoc.data().autorizado){ showAlert('No autorizado.❌','error'); return; }

      const newId = await addReservation(date, time);
      if (!newId) return;

      if (!calStudent.getEventById(newId)){
        calStudent.addEvent({ id:newId, title:`Clase MMA - ${time}`, start:`${date}T${time}:00`, allDay:false, extendedProps:{temp:true} });
      }
      showAlert('Reserva confirmada 👍','success');
      setTimeout(()=> calStudent?.refetchEvents(), 250);
    }catch(e){ console.error(e); showAlert('❗Error confirmando reserva.❗','error'); }
    finally{ hideLoader(); closeModal(); }
  };
  document.getElementById('cancelBtn').onclick = closeModal;
}
function openDeleteReservationModal(resId, date, time){
  closeModal();
  const m = document.createElement('div'); m.className='custom-modal';
  m.innerHTML = `
    <div class="modal-content">
      <p>¿Eliminar reserva del ${date} a las ${time}?</p>
      <button id="deleteBtn" class="btn error">Eliminar</button>
      <button id="cancelDeleteBtn" class="btn">Cancelar</button>
    </div>`;
  document.body.appendChild(m);

  document.getElementById('deleteBtn').onclick = async () => {
    if (!canCancel(date, time)){ showAlert('No puedes cancelar durante o después de la clase.','error'); closeModal(); return; }
    try{ await deleteReservation(resId);}catch{} finally{ closeModal(); }
  };
  document.getElementById('cancelDeleteBtn').onclick = closeModal;
}
function closeModal(){ const m=document.querySelector('.custom-modal'); if (m) m.remove(); }

/* ───────── Profesor/Admin: asistencia (popup) ───────── */
async function getReservasPorDia(day){
  const snap = await getDocs(collection(db,'asistencias',day,'usuarios'));
  return snap.docs.map(d=>({ uid:d.id, nombre:d.data().nombre, presente:d.data().presente || false }));
}
function openAttendancePopup(list, day){
  killTooltips();
  const m = document.getElementById('attModal');
  const l = document.getElementById('attList');
  const d = document.getElementById('attDate');
  if (!m || !l || !d) return;
  d.textContent = day;
  l.innerHTML = '';
  list.forEach(u => {
    const row = document.createElement('div');
    row.className = 'att-item';
    row.innerHTML = `
      <input type="checkbox" id="att_${u.uid}" ${u.presente ? 'checked':''} />
      <label for="att_${u.uid}" style="flex:1">${u.nombre}</label>
    `;
    row.querySelector('input').addEventListener('change', async (e)=>{
      try{
        await updateDoc(doc(db,'asistencias',day,'usuarios',u.uid), { presente: e.target.checked });
        showAlert('Asistencia actualizada','success');
      }catch(err){ console.error(err); showAlert('Error al guardar asistencia','error'); }
    });
    l.appendChild(row);
  });
  m.classList.add('active');
}

/* ───────── Boot ───────── */
document.addEventListener('DOMContentLoaded', () => {
  // Navbar estable
  ensureNavCSS();
  bindSidebarOnce();
  bindLogoutOnce();

  // Botón de logout rojo (si existe en UI)
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.addEventListener('click', async () => {
      try { await signOut(auth); showAlert('Has cerrado sesión','success'); setTimeout(()=>location.href='index.html',900); }
      catch { showAlert('Error al cerrar sesión','error'); }
    });
    logoutBtn.dataset.bound = '1';
  }

  onAuthStateChanged(auth, async user => {
    if (!user) { location.href='./index.html'; return; }

    // Código de asistencia
    const codeEl = document.getElementById('attendanceCodeDisplay');
    if (codeEl) {
      try {
        const snap = await getDoc(doc(db,'users',user.uid));
        codeEl.textContent = `Tu código de asistencia: ${snap.exists() ? (snap.data().attendanceCode || '—') : '—'}`;
      } catch {
        codeEl.textContent='Error al cargar el código.';
      }
    }

    // Reloj CR
    const localTimeEl = document.getElementById('local-time');
    if (localTimeEl) {
      const fmt = new Intl.DateTimeFormat('es-CR',{hour:'numeric',minute:'numeric',second:'numeric',hour12:true,timeZone: CR_TZ});
      const tick=()=>localTimeEl.textContent=`Hora en Costa Rica: ${fmt.format(new Date())}`;
      tick(); setInterval(tick,1000);
    }

    // Roles
    let roles = [];
    try {
      const u = await getDoc(doc(db,'users',user.uid));
      roles = u.exists() ? (u.data().roles || []) : [];
    } catch {}

    const isStaff = roles.includes('professor') || roles.includes('admin');
    const switchWrap = document.getElementById('roleSwitchWrap');
    const deck       = document.getElementById('calendarDeck');
    const elStudent  = document.getElementById('calendarStudent');
    const elProf     = document.getElementById('calendarProf');

    // Mostrar switch sólo si tiene rol de staff
    if (switchWrap) switchWrap.classList.toggle('hidden', !isStaff);

    // Render estudiante siempre
    buildStudentCalendar(elStudent);

    // Render staff solo si tiene permiso
    if (isStaff) {
      buildStaffCalendar(elProf);

      // wiring del switch
      const toggle = document.getElementById('modeToggle');
      if (toggle && !toggle.dataset.bound){
        toggle.addEventListener('change', ()=>{
          deck?.setAttribute('data-mode', toggle.checked ? 'prof' : 'student');
          // ajustar tamaño al cambiar
          if (toggle.checked) { calStaff?.updateSize(); } else { calStudent?.updateSize(); }
        });
        toggle.dataset.bound = '1';
      }
    } else {
      // fuerza vista estudiante
      deck?.setAttribute('data-mode', 'student');
    }
  });
});
