// ./js/client.js — Student/Professor dual render + flip + admin-like staff view + RT + loader (+tooltip fix)
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
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ───────── Estado ───────── */
let calStudent = null;
let calStaff   = null;
let unsubStudent = null;
let unsubStaff   = null;

/* ───────── Loader ───────── */
function ensureLoader(){
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

/* ───── CSS inyectado (crisp + switch + popup admin) ───── */
(function injectCSS(){
  if (document.getElementById('client-extras-css')) return;
  const s = document.createElement('style');
  s.id = 'client-extras-css';
  s.textContent = `
    .calendar-wrapper, #calendar, .calendar-pane { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; transform: translateZ(0); backface-visibility: hidden; }

    .calendar-panes{ position:relative; }
    .calendar-pane{ position:relative; }
    .calendar-pane.hidden{ display:none; }
    .calendar-pane.visible{ display:block; }

    .flip-enter{ transform:rotateY(90deg); opacity:.2; transition:.25s ease; }
    .flip-enter-active{ transform:rotateY(0); opacity:1; }
    .flip-leave{ transform:rotateY(0); opacity:1; transition:.22s ease; }
    .flip-leave-active{ transform:rotateY(90deg); opacity:0; }

    .mode-switch{ display:flex; align-items:center; justify-content:center; gap:12px; margin:14px 0 6px; }
    .mode-label{ font-weight:700; opacity:.8 }
    .toggle{ position:relative; width:54px; height:28px; background:#1f2937; border:1px solid #334155; border-radius:999px; cursor:pointer; }
    .toggle::after{ content:""; position:absolute; top:2px; left:2px; width:24px; height:24px; border-radius:50%; background:#9aa4ad; transition:.18s ease; }
    .toggle.on{ background:#14532d; border-color:#166534; }
    .toggle.on::after{ left:28px; background:#22c55e; }

    /* popup estilo admin (overlay) */
    #attModal{ position:fixed; inset:0; display:none; place-items:center; z-index:10000; background:rgba(0,0,0,.45); }
    #attModal.active{ display:grid; }
    #attModal .att-card{ width:min(92vw,520px); background:#0c131a; border:1px solid #22303d; border-radius:14px; padding:14px; box-shadow:0 12px 28px rgba(0,0,0,.35); }
    #attModal .att-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
    #attModal .att-list{ display:grid; gap:8px; max-height:50vh; overflow:auto; padding-right:4px; }
    #attModal .att-item{ display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid #233140; border-radius:10px; background:#0f1720; }
    #attModal .close-btn{ padding:8px 12px; border-radius:10px; background:#1f2937; border:1px solid #334155; color:#e5e7eb; cursor:pointer; }

    /* que los números del conteo se vean fuertes, como en admin */
    .fc-daygrid-event .fc-event-title{ font-weight:800; }
  `;
  document.head.appendChild(s);
})();

/* Afinar el modal (un poco más delgado) */
(function(){
  if (document.getElementById('att-modal-tighter')) return;
  const s = document.createElement('style');
  s.id = 'att-modal-tighter';
  s.textContent = `
    #attModal .att-card{ width: min(92vw, 460px); }
    #attModal .att-item{ padding: 6px 10px; }
  `;
  document.head.appendChild(s);
})();

/* ───── Helpers fecha/tiempo (CR) ───── */
const CR_TZ = 'America/Costa_Rica';
const CR_OFFSET = '-06:00'; // CR sin DST

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
function isDateNotPastCR(dateStr){
  const {year:cy,month:cm,day:cd}=getTodayCRParts();
  const [y,m,d]=dateStr.split('-').map(Number);
  if(y<cy) return false; if(y>cy) return true;
  if(m<cm) return false; if(m>cm) return true;
  return d>=cd;
}
function nowCRString(){
  const d = new Intl.DateTimeFormat('en-CA',{ timeZone: CR_TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  const t = new Intl.DateTimeFormat('en-GB',{ timeZone: CR_TZ, hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date());
  return { date:d, time:t };
}
function crDateTime(dateStr, timeStr){
  return new Date(`${dateStr}T${timeStr}:00${CR_OFFSET}`);
}
/* Reserva: permitida si es futuro y, si es hoy, con ≥ 60 minutos de anticipación */
function canBook(dateStr, timeStr){
  const {date:today, time:nowT} = nowCRString();
  const now  = crDateTime(today, nowT);
  const slot = crDateTime(dateStr, timeStr);
  const diffMs = slot - now;
  if (diffMs <= 0) return { ok:false, reason:'during_or_after' };
  if (dateStr === today && diffMs < 60*60*1000) {
    return { ok:false, reason:'lt1h', minutesLeft: Math.max(0, Math.floor(diffMs/60000)) };
  }
  return { ok:true };
}
/* Cancelar: solo si aún no empieza (estrictamente antes del inicio) */
function canCancel(dateStr, timeStr){
  const {date:today, time:nowT} = nowCRString();
  const now  = crDateTime(today, nowT);
  const slot = crDateTime(dateStr, timeStr);
  return (slot - now) > 0;
}

/* ───── Contenedores de ambos calendarios ───── */
function ensureCalendarHolders(){
  const card = document.querySelector('.calendar-wrapper .card');
  if (!card) return null;

  let shell = card.querySelector('#calendar');
  if (!shell){
    shell = document.createElement('div');
    shell.id = 'calendar';
    shell.className = 'calendar-panes';
    card.innerHTML = '';
    card.appendChild(shell);
  }

  let sHold = shell.querySelector('#calStudentHolder');
  let aHold = shell.querySelector('#calStaffHolder');
  if (!sHold){
    sHold = document.createElement('div');
    sHold.id = 'calStudentHolder';
    sHold.className = 'calendar-pane visible';
    shell.appendChild(sHold);
  }
  if (!aHold){
    aHold = document.createElement('div');
    aHold.id = 'calStaffHolder';
    aHold.className = 'calendar-pane hidden';
    shell.appendChild(aHold);
  }
  return { shell, sHold, aHold };
}

/* ───── Popup asistencia (inyectado) ───── */
function ensureAttendancePopup(){
  if (document.getElementById('attModal')) return;
  const m = document.createElement('div');
  m.className = 'att-modal';
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
  m.querySelector('#attClose').onclick = () => {
    m.classList.remove('active');
    killTooltips(); // limpiar tooltips al cerrar
  };
}

/* ─── Mata-tooltips (para evitar que queden detrás del modal) ─── */
function killTooltips() {
  document.querySelectorAll('.custom-tooltip').forEach(el => el.remove());
}

/* ───── Boot ───── */
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar + logout
  const toggleBtn = document.getElementById("toggleNav");
  const sidebar   = document.getElementById("sidebar");
  if (toggleBtn && sidebar) toggleBtn.addEventListener("click", () => sidebar.classList.toggle("active"));

  const logoutSidebar = document.getElementById("logoutSidebar");
  if (logoutSidebar) {
    logoutSidebar.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await signOut(auth); showAlert("Has cerrado sesión","success"); setTimeout(()=>location.href="index.html",900);
      } catch { showAlert("Error al cerrar sesión","error"); }
    });
  }

  onAuthStateChanged(auth, async user => {
    if (!user) { location.href='./index.html'; return; }

    // código de asistencia
    const codeEl = document.getElementById('attendanceCodeDisplay');
    if (codeEl) {
      try {
        const snap = await getDoc(doc(db,'users',user.uid));
        codeEl.textContent = `Tu código de asistencia: ${snap.exists() ? (snap.data().attendanceCode || '—') : '—'}`;
      } catch { codeEl.textContent='Error al cargar el código.'; }
    }

    // reloj CR
    const localTimeEl = document.getElementById('local-time');
    if (localTimeEl) {
      const fmt = new Intl.DateTimeFormat('es-CR',{hour:'numeric',minute:'numeric',second:'numeric',hour12:true,timeZone: CR_TZ});
      const tick=()=>localTimeEl.textContent=`Hora en Costa Rica: ${fmt.format(new Date())}`;
      tick(); setInterval(tick,1000);
    }

    // roles
    let roles = [];
    try {
      const u = await getDoc(doc(db,'users',user.uid));
      roles = u.exists() ? (u.data().roles || []) : [];
    } catch {}

    const holders = ensureCalendarHolders();
    if (!holders) return;

    // switch solo si tiene ambos
    const hasBoth = roles.includes('student') && roles.includes('professor');
    if (hasBoth) buildModeSwitch(holders.shell);

    // popup estilo admin
    ensureAttendancePopup();

    // levantar ambos calendarios (siempre)
    buildStudentCalendar(holders.sHold);
    buildStaffCalendar(holders.aHold);

    if (!hasBoth){
      holders.sHold.classList.add('visible');
      holders.aHold.classList.add('hidden');
    }
  });
});

/* ───── Switch con flip ───── */
function buildModeSwitch(shell){
  if (document.getElementById('modeSwitch')) return;
  const hostCard = document.querySelector('.calendar-wrapper .card');
  if (!hostCard) return;

  const wrap = document.createElement('div');
  wrap.className = 'mode-switch';
  wrap.id = 'modeSwitch';
  wrap.innerHTML = `
    <span class="mode-label">Estudiante</span>
    <div id="modeToggle" class="toggle" role="switch" aria-checked="false" tabindex="0"></div>
    <span class="mode-label">Profesor</span>
  `;
  hostCard.parentElement.insertBefore(wrap, hostCard.nextSibling);

  const t = wrap.querySelector('#modeToggle');
  const change = () => {
    const toStaff = t.classList.toggle('on');
    t.setAttribute('aria-checked', String(toStaff));
    doFlip(shell, toStaff ? 'staff' : 'student');
  };
  t.addEventListener('click', change);
  t.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter'){ e.preventDefault(); change(); }});
}

function doFlip(shell, mode){
  const sHold = shell.querySelector('#calStudentHolder');
  const aHold = shell.querySelector('#calStaffHolder');
  shell.classList.add('flip-leave');
  setTimeout(() => {
    shell.classList.remove('flip-leave');
    if (mode==='staff'){
      sHold.classList.add('hidden');  sHold.classList.remove('visible');
      aHold.classList.remove('hidden'); aHold.classList.add('visible');
      calStaff?.updateSize();
    } else {
      aHold.classList.add('hidden');  aHold.classList.remove('visible');
      sHold.classList.remove('hidden'); sHold.classList.add('visible');
      calStudent?.updateSize();
    }
    shell.classList.add('flip-enter');
    requestAnimationFrame(()=> shell.classList.add('flip-enter-active'));
    setTimeout(()=> shell.classList.remove('flip-enter','flip-enter-active'), 260);
  }, 160);
}

/* ───── Calendario: Estudiante ───── */
function buildStudentCalendar(holder){
  if (unsubStudent){ try{unsubStudent();}catch{} unsubStudent=null; }
  if (calStudent){ try{calStudent.destroy();}catch{} calStudent=null; }
  holder.innerHTML='';

  calStudent = new FullCalendar.Calendar(holder, {
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
      const dow = info.date.getUTCDay();
      if(!isDateInCurrentMonthCR(dateStr)){ showAlert('Solo puedes reservar en el mes actual.','error'); return; }
      if(dow!==5 && dow!==6){ showAlert('Solo viernes y sábados.','error'); return; }

      const classTime = (dow===5) ? '20:30' : '09:00';
      const check = canBook(dateStr, classTime);
      if (!check.ok){
        if (check.reason === 'lt1h'){
          showAlert(`Para hoy solo puedes reservar hasta 1 hora antes.`, 'error');
        } else {
          showAlert('No puedes reservar durante o después de la clase.', 'error');
        }
        return;
      }
      openConfirmReservationModal(dateStr, classTime);
    },

    eventClick(info){
      const [d,t] = info.event.startStr.split('T');
      const time  = (t||'').slice(0,5);
      if (!canCancel(d, time)){
        showAlert('No puedes cancelar durante o después de la clase.', 'error');
        return;
      }
      openDeleteReservationModal(info.event.id, d, time);
    },

    dayCellClassNames(arg){ const d=arg.date.getUTCDay(); return (d!==5 && d!==6) ? ['disabled-day'] : []; }
  });

  requestAnimationFrame(()=>{ calStudent.render(); setTimeout(()=>calStudent.updateSize(), 40); });
}

/* ───── Calendario: Profesor (apariencia/UX de admin.js) ───── */
function buildStaffCalendar(holder){
  ensureAttendancePopup();

  if (unsubStaff){ try{unsubStaff();}catch{} unsubStaff=null; }
  if (calStaff){ try{calStaff.destroy();}catch{} calStaff=null; }
  holder.innerHTML='';

  calStaff = new FullCalendar.Calendar(holder, {
    locale:'es',
    initialView:'dayGridMonth',
    timeZone: CR_TZ,
    headerToolbar:{ left:'', center:'title', right:'' },
    height:'auto', contentHeight:'auto', expandRows:true, handleWindowResize:true,

    events(info, success, failure){
      const qAll = query(collection(db,'reservations')); // sin filtros ⇒ sin índice
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

    // Evita tooltips cuando el modal esté visible y límpialos al hacer click
    eventMouseEnter: info => {
      const modalActive = document.getElementById('attModal')?.classList.contains('active');
      if (modalActive) return;

      const tip = document.createElement('div');
      tip.className = 'custom-tooltip';
      tip.style.cssText = 'position:fixed; z-index:10001; background:#0b2540; color:#b4d7ff; border:1px solid #1e3a5f; padding:6px 8px; border-radius:8px; pointer-events:none;';
      tip.innerHTML = `<strong>Usuarios:</strong><br>${(info.event.extendedProps.names||[]).join('<br>')}`;
      document.body.appendChild(tip);
      const move = e => { tip.style.left = `${e.pageX+10}px`; tip.style.top = `${e.pageY+10}px`; };
      const cleanup = () => tip.remove();
      info.el.addEventListener('mousemove', move);
      info.el.addEventListener('mouseleave', cleanup);
      info.el.addEventListener('click', cleanup);
    },

    eventClick: async info => {
      killTooltips(); // limpiar por si quedó alguno
      const day = info.event.startStr;
      const list = await getReservasPorDia(day);
      openAttendancePopup(list, day);
    },

    dayCellClassNames(arg){ const d=arg.date.getUTCDay(); return (d!==5 && d!==6) ? ['disabled-day'] : []; }
  });

  requestAnimationFrame(()=>{ calStaff.render(); setTimeout(()=>calStaff.updateSize(), 40); });
}

/* ───── CRUD reservas (estudiante) ───── */
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

/* ───── Modales (estudiante) ───── */
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
      // Doble verificación por si pasa tiempo entre abrir y confirmar
      const check = canBook(date, time);
      if (!check.ok){
        if (check.reason === 'lt1h'){
          showAlert(`Para hoy solo puedes reservar hasta 1 hora antes.`, 'error');
        } else {
          showAlert('No puedes reservar durante o después de la clase.', 'error');
        }
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
    if (!canCancel(date, time)){
      showAlert('No puedes cancelar durante o después de la clase.', 'error');
      closeModal();
      return;
    }
    try{ await deleteReservation(resId);}catch{} finally{ closeModal(); }
  };
  document.getElementById('cancelDeleteBtn').onclick = closeModal;
}
function closeModal(){ const m=document.querySelector('.custom-modal'); if (m) m.remove(); }

/* ───── Profesor/Admin: asistencia (idéntico a admin.js) ───── */
async function getReservasPorDia(day){
  const snap = await getDocs(collection(db,'asistencias',day,'usuarios'));
  return snap.docs.map(d=>({ uid:d.id, nombre:d.data().nombre, presente:d.data().presente || false }));
}
function openAttendancePopup(list, day){
  killTooltips(); // ← quita cualquier tooltip vivo
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
function cerrarPopup(){ const p=document.getElementById('attModal'); if(p) p.classList.remove('active'); }

/* ───── Logout rojo (si existe) ───── */
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try { await signOut(auth); showAlert('Has cerrado sesión','success'); setTimeout(()=>location.href='index.html',900);
    } catch { showAlert('Error al cerrar sesión','error'); }
  });
}
