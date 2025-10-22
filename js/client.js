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

/* ───────── Sidebar (mismo comportamiento que admin) ───────── */
function ensureSidebarRuntimeDefaults(){
  // Backdrop si no existe
  if (!document.getElementById('sidebarBackdrop')){
    const bd = document.createElement('div');
    bd.id = 'sidebarBackdrop';
    bd.className = 'sidebar-backdrop';
    document.body.appendChild(bd);
  }
  const sb  = document.getElementById('sidebar');
  const btn = document.getElementById('toggleNav');
  if (btn){
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'sidebar');
  }
  // Asegura visibilidad (evita flashes raros)
  if (sb){ sb.style.visibility = 'visible'; }
}
function toggleSidebar(forceOpen){
  const sb   = document.getElementById('sidebar');
  const btn  = document.getElementById('toggleNav');
  const back = document.getElementById('sidebarBackdrop');
  if (!sb || !btn) return;

  const willOpen = (typeof forceOpen === 'boolean')
    ? forceOpen
    : !sb.classList.contains('active');

  if (willOpen){
    sb.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    back?.classList.add('active');
  } else {
    sb.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    back?.classList.remove('active');
  }
}
function bindSidebarOnce(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  const back= document.getElementById('sidebarBackdrop');
  if (!btn || !sb || btn.dataset.bound) return;

  const handler = (e)=>{ e.preventDefault(); toggleSidebar(); };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', handler, { passive:false });

  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') toggleSidebar(false); });
  back?.addEventListener('click', ()=> toggleSidebar(false));
  back?.addEventListener('touchstart', ()=> toggleSidebar(false), { passive:true });

  // Cerrar al navegar dentro del sidebar
  sb.addEventListener('click', (e)=>{
    const a = e.target.closest('a[href]');
    if (a) toggleSidebar(false);
  });

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
function bindNavbarActions(){
  const hard    = document.getElementById('navHardReset');
  const install = document.getElementById('navInstall');
  const ios     = document.getElementById('navInstallIOS');

  hard?.addEventListener('click', (e)=>{ e.preventDefault(); window.forceHardReset?.(); toggleSidebar(false); });

  install?.addEventListener('click', (e)=>{
    e.preventDefault();
    if (window.tryPWAInstall) { window.tryPWAInstall(); }
    else if (window.deferredPrompt) { window.deferredPrompt.prompt(); }
    else { showAlert('Ejecutando proceso de instalacion!.', 'success'); }
    toggleSidebar(false);
  });

  ios?.addEventListener('click', (e)=>{
    e.preventDefault();
    showAlert('En iPhone: botón Compartir ▸ “Añadir a pantalla de inicio”.', 'success');
    toggleSidebar(false);
  });
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

/* ───────── Modal asistencia (profesor) ───────── */
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

/* ───────── Sizing del deck (altura exacta del calendario visible) ───────── */
let _sizeDeckTimer = null;
function sizeDeckNow(){
  const deck = document.getElementById('calendarDeck');
  if (!deck) return;
  const isProf = deck.dataset.mode === 'prof';
  const face   = deck.querySelector(isProf ? '.face-prof' : '.face-student');
  if (!face) return;

  // Intenta medir el contenedor real del FC
  const inner = face.querySelector('.fc') || face.querySelector('.fc-shell') || face.firstElementChild;
  const h = (inner?.offsetHeight || face.offsetHeight || 0);
  deck.style.height = h ? `${h}px` : '';
}
function sizeDeckSoon(){ clearTimeout(_sizeDeckTimer); _sizeDeckTimer = setTimeout(sizeDeckNow, 50); }
function queueSizeDeck(){ sizeDeckSoon(); }

/* ───────── Flip 3D sin blur (transform solo durante animación) ───────── */
function restDeckTransforms() {
  const deck = document.getElementById('calendarDeck');
  if (!deck) return;
  const isProf = deck.dataset.mode === 'prof';
  const s = deck.querySelector('.face-student');
  const p = deck.querySelector('.face-prof');

  // En reposo: la cara visible queda con transform:none (nítido)
  if (s) {
    s.style.transform = isProf ? 'rotateY(180deg)' : 'none';
    s.style.pointerEvents = isProf ? 'none' : 'auto';
  }
  if (p) {
    p.style.transform = isProf ? 'none' : 'rotateY(180deg)';
    p.style.pointerEvents = isProf ? 'auto' : 'none';
  }

  deck.classList.remove('animating');
  queueSizeDeck();
}
function flipDeckAnimate() {
  const deck = document.getElementById('calendarDeck');
  if (!deck) return;
  deck.classList.add('animating');

  const end = () => {
    deck.removeEventListener('transitionend', end, true);
    restDeckTransforms(); // vuelve a estado nítido
  };
  deck.addEventListener('transitionend', end, true);
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
          queueSizeDeck();
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

  requestAnimationFrame(()=>{
    calStudent.render();
    setTimeout(()=>{ calStudent.updateSize(); queueSizeDeck(); }, 40);
  });
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
      const qAll = query(collection(db,'reservations')); // requiere reglas para staff
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
          queueSizeDeck();
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

  requestAnimationFrame(()=>{
    calStaff.render();
    setTimeout(()=>{ calStaff.updateSize(); queueSizeDeck(); }, 40);
  });
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
  ensureSidebarRuntimeDefaults();
  bindSidebarOnce();
  bindLogoutOnce();
  bindNavbarActions();

  // Recalcular alto del deck en cambios de viewport
  window.addEventListener('resize', sizeDeckSoon);
  window.addEventListener('orientationchange', sizeDeckSoon);

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

    if (switchWrap) switchWrap.classList.toggle('hidden', !isStaff);

    // Render estudiante siempre
    buildStudentCalendar(elStudent);

    // Render staff si procede
    if (isStaff) {
      buildStaffCalendar(elProf);

      // wiring del switch
      const toggle = document.getElementById('modeToggle');
      if (toggle && !toggle.dataset.bound){
        toggle.addEventListener('change', ()=>{
          deck?.setAttribute('data-mode', toggle.checked ? 'prof' : 'student');
          flipDeckAnimate();                 // animación 3D sin blur
          if (toggle.checked) { calStaff?.updateSize(); } else { calStudent?.updateSize(); }
          queueSizeDeck();
        });
        toggle.dataset.bound = '1';
      }
    } else {
      deck?.setAttribute('data-mode', 'student');
    }

    // Estado inicial nítido + altura correcta del deck
    restDeckTransforms();
    queueSizeDeck();
  });
});
