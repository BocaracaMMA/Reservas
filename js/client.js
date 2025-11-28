// ./js/client.js — Cliente
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, getDocs, getDoc, addDoc, doc, query, where, deleteDoc,
  onSnapshot, setDoc, updateDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ───────── Estado global ───────── */
let calStudent   = null;
let calStaff     = null;
let unsubStudent = null;
let unsubStaff   = null;

/* Horario de clases configurado en admin-calendario */
let scheduleBlocks   = [];
let availableDaysSet = new Set();

/* Mapa de ocupación por día para pintar el calendario */
let dayOccupancyMap  = {}; // dateStr -> { full: bool, busy: bool }

/* Mapa de excepciones de calendario:
   dateStr "YYYY-MM-DD" -> {
     action: "block" | "override" | "add" | "none",
     overrideSlots: [...],
     addSlots: [...],
     reason: string
   }
*/
let calendarExceptionsMap = {};

/* ───────── Sidebar (mismo comportamiento que admin) ───────── */
function ensureSidebarRuntimeDefaults() {
  if (!document.getElementById('sidebarBackdrop')) {
    const bd = document.createElement('div');
    bd.id = 'sidebarBackdrop';
    bd.className = 'sidebar-backdrop';
    document.body.appendChild(bd);
  }
  const sb  = document.getElementById('sidebar');
  const btn = document.getElementById('toggleNav');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'sidebar');
  }
  if (sb) sb.style.visibility = 'visible';
}

function toggleSidebar(forceOpen) {
  const sb   = document.getElementById('sidebar');
  const btn  = document.getElementById('toggleNav');
  const back = document.getElementById('sidebarBackdrop');
  if (!sb || !btn) return;

  const willOpen = (typeof forceOpen === 'boolean')
    ? forceOpen
    : !sb.classList.contains('active');

  if (willOpen) {
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

function bindSidebarOnce() {
  const btn  = document.getElementById('toggleNav');
  const sb   = document.getElementById('sidebar');
  const back = document.getElementById('sidebarBackdrop');
  if (!btn || !sb || btn.dataset.bound) return;

  const handler = (e) => { e.preventDefault(); toggleSidebar(); };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', handler, { passive: false });

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSidebar(false); });
  back?.addEventListener('click', () => toggleSidebar(false));
  back?.addEventListener('touchstart', () => toggleSidebar(false), { passive: true });

  sb.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a) toggleSidebar(false);
  });

  btn.dataset.bound = '1';
}

function bindLogoutOnce() {
  const a = document.getElementById('logoutSidebar');
  if (!a || a.dataset.bound) return;
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      showAlert('Has cerrado sesión', 'success');
      setTimeout(() => location.href = 'index.html', 900);
    } catch {
      showAlert('Error al cerrar sesión', 'error');
    }
  });
  a.dataset.bound = '1';
}

/* ───────── Navbar: PWA + acciones ───────── */
function bindNavbarActions() {
  const hard    = document.getElementById('navHardReset');
  const install = document.getElementById('navInstall');
  const ios     = document.getElementById('navInstallIOS');

  hard?.addEventListener('click', (e) => {
    e.preventDefault();
    window.forceHardReset?.();
    toggleSidebar(false);
  });

  install?.addEventListener('click', (e) => {
    e.preventDefault();
    let done = false;
    try {
      if (typeof window.tryPWAInstall === 'function') {
        window.tryPWAInstall();
        done = true;
      }
    } catch {}
    if (!done) {
      const btn = document.getElementById('btnInstall');
      if (btn) { btn.click(); done = true; }
    }
    if (!done) showAlert('La instalación no está disponible ahora.', 'error');
    toggleSidebar(false);
  });

  ios?.addEventListener('click', (e) => {
    e.preventDefault();
    const tipBtn = document.getElementById('btnIosTip');
    if (tipBtn) tipBtn.click();
    else showAlert('En iPhone: Compartir ▸ “Añadir a pantalla de inicio”.', 'success');
    toggleSidebar(false);
  });
}

/* ───────── Loader simple ───────── */
function ensureLoader() {
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
function showLoader() { ensureLoader(); document.getElementById('global-loader').style.display = 'grid'; }
function hideLoader() { const el = document.getElementById('global-loader'); if (el) el.style.display = 'none'; }

/* ───────── Modal asistencia (profesor) ───────── */
function ensureAttendancePopup() {
  if (document.getElementById('attModal')) return;
  const m = document.createElement('div');
  m.id = 'attModal';
  m.innerHTML = `
    <div class="att-card">
      <div class="att-head">
        <h3 id="attDate" class="att-title">—</h3>
        <button id="attClose" class="close-btn" aria-label="Cerrar"></button>
      </div>
      <div id="attList" class="att-list"></div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#attClose').onclick = () => { m.classList.remove('active'); killTooltips(); };
}
function killTooltips() { document.querySelectorAll('.custom-tooltip').forEach(el => el.remove()); }

/* ───────── Helpers horarios CR + reglas de reserva/cancelación ───────── */
const CR_TZ     = 'America/Costa_Rica';
const CR_OFFSET = '-06:00';

function getTodayCRParts() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: CR_TZ });
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function isDateInCurrentMonthCR(dateStr) {
  const { year: cy, month: cm } = getTodayCRParts();
  const [y, m] = dateStr.split('-').map(Number);
  return y === cy && m === cm;
}

function nowCRString() {
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: CR_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: CR_TZ, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
  return { date: d, time: t };
}

function crDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00${CR_OFFSET}`);
}

function canBook(dateStr, timeStr) {
  const { date: today, time: nowT } = nowCRString();
  const now  = crDateTime(today, nowT);
  const slot = crDateTime(dateStr, timeStr);
  const diffMs = slot - now;
  if (diffMs <= 0) return { ok: false, reason: 'during_or_after' };
  if (dateStr === today && diffMs < 60 * 60 * 1000) return { ok: false, reason: 'lt1h' };
  return { ok: true };
}

function canCancel(dateStr, timeStr) {
  const { date: today, time: nowT } = nowCRString();
  const now  = crDateTime(today, nowT);
  const slot = crDateTime(dateStr, timeStr);
  return (slot - now) > 0;
}

/* ───────── Helpers de formato (12h y fecha larga) ───────── */
function formatTime12(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  let h = Number(hStr);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  const mm = mStr.padStart(2, '0').slice(0, 2);
  return `${h}:${mm} ${suffix}`;
}

function formatRange12(startTime, endTime) {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTime12(startTime);
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`;
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('es-CR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: CR_TZ
    }).format(base);
  } catch {
    return dateStr;
  }
}

/* ───────── Horario de clases (classSchedule) ───────── */
function computeAvailableDays(blocks) {
  const set = new Set();
  blocks.forEach(b => {
    const isActive = b.active !== false;
    if (!isActive) return;
    const dow = Number(b.dayOfWeek ?? NaN);
    if (!Number.isNaN(dow)) set.add(dow);
  });
  return set;
}

async function loadClassScheduleForBookings() {
  try {
    const snap = await getDocs(collection(db, 'classSchedule'));
    const arr = [];
    snap.forEach(docSnap => arr.push({ id: docSnap.id, ...docSnap.data() }));
    scheduleBlocks   = arr.filter(b => b.active !== false);
    availableDaysSet = computeAvailableDays(scheduleBlocks);
  } catch (err) {
    console.error('[client] No se pudo cargar classSchedule:', err);
    scheduleBlocks   = [];
    availableDaysSet = new Set();
  }
}

/* ───────── Excepciones de calendario (calendarExceptions) ───────── */

/**
 * Carga todas las excepciones de calendario.
 * Dado que la colección será pequeña, es más robusto que trabajar por rangos.
 */
async function loadCalendarExceptions(force = false) {
  if (!force && Object.keys(calendarExceptionsMap).length) {
    return;
  }

  try {
    const snap = await getDocs(collection(db, 'calendarExceptions'));
    const map  = {};
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const date = data.date;
      if (!date) return;
      map[date] = {
        action: data.action || 'block',
        overrideSlots: Array.isArray(data.overrideSlots) ? data.overrideSlots : [],
        addSlots: Array.isArray(data.addSlots) ? data.addSlots : [],
        reason: data.reason || ''
      };
    });
    calendarExceptionsMap = map;
    console.log('[client] calendarExceptions cargadas:', calendarExceptionsMap);
  } catch (err) {
    console.error('[client] Error leyendo calendarExceptions:', err);
    calendarExceptionsMap = {};
  }
}

/**
 * Compatibilidad con el código que pedía cargar por rango.
 * Ahora simplemente nos aseguramos de que el mapa esté cargado.
 */
async function loadCalendarExceptionsForRange(startDateStr, endDateStr) {
  await loadCalendarExceptions(false);
}

/* ───────── Helpers de cupos (min/max) ───────── */

function normalizeCapacity(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Devuelve los bloques de clase efectivos para una fecha concreta (string YYYY-MM-DD),
 * combinando el horario base semanal (classSchedule) + calendarExceptions (block/override/add).
 */
function getBlocksForDate(dateStr) {
  if (!scheduleBlocks.length || !dateStr) return [];

  let dow = NaN;
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    dow = dt.getUTCDay(); // 0=dom ... 6=sáb, independiente de la zona local
  } catch {
    return [];
  }

  // Horario base según día de semana
  let blocksForDay = scheduleBlocks
    .filter(b => {
      const isActive = b.active !== false;
      if (!isActive) return false;
      const bdow = Number(b.dayOfWeek ?? NaN);
      return !Number.isNaN(bdow) && bdow === dow;
    })
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const ex = calendarExceptionsMap[dateStr];
  if (!ex) return blocksForDay;

  const action = ex.action || 'block';

  // Día completamente bloqueado
  if (action === 'block') {
    return [];
  }

  // Normaliza slots de override/add a la misma estructura de classSchedule
  const normalizeSlots = (slots, prefix) => {
    if (!Array.isArray(slots)) return [];
    return slots.map((slot, idx) => {
      const s = slot || {};
      return {
        id: s.id || `${prefix}-${dateStr}-${idx}`,
        dayOfWeek: dow,
        startTime: s.startTime,
        endTime: s.endTime,
        type: s.type || s.classType || 'Clase especial',
        minCapacity: normalizeCapacity(s.minCapacity),
        maxCapacity: normalizeCapacity(s.maxCapacity),
        professorId: s.professorId || s.profId || '',
        professorName: s.professorName || s.profName || '',
        colorKey: s.colorKey || s.type || s.classType || 'Evento especial',
        active: true,
        permanent: false
      };
    });
  };

  const overrideBlocks = normalizeSlots(ex.overrideSlots, 'override');
  const addBlocks      = normalizeSlots(ex.addSlots, 'add');

  if (action === 'override') {
    return overrideBlocks.sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || '')
    );
  }

  if (action === 'add') {
    const merged = blocksForDay.concat(addBlocks).sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || '')
    );
    return merged;
  }

  // Acción desconocida → usamos sólo el horario semanal
  return blocksForDay;
}

/* ───────── Estadísticas de reservas (cupos) ───────── */

async function getReservationStatsForDate(dateStr) {
  // 1) Reservas NUEVAS en colección "reservations"
  const qRes = query(
    collection(db, 'reservations'),
    where('date', '==', dateStr)
  );
  const snapRes = await getDocs(qRes);

  const byClassId = {};   // reservas nuevas por classId
  const byTimeNew = {};   // reservas nuevas por hora (fallback)

  snapRes.forEach(docSnap => {
    const data = docSnap.data() || {};
    const cId  = data.classId || null;
    const time = data.time || null;

    if (cId)  byClassId[cId]  = (byClassId[cId]  || 0) + 1;
    if (time) byTimeNew[time] = (byTimeNew[time] || 0) + 1;
  });

  // 2) Registros VIEJOS en "asistencias/{fecha}/usuarios"
  //    Solo contamos los que NO tienen "_" en el id
  const legacyByTime = {};
  try {
    const attSnap = await getDocs(collection(db, 'asistencias', dateStr, 'usuarios'));
    attSnap.forEach(docSnap => {
      const docId = docSnap.id || '';
      const data  = docSnap.data() || {};
      if (docId.includes('_')) return; // nuevos → ignorar aquí

      const time = data.hora || null;
      if (!time) return;
      legacyByTime[time] = (legacyByTime[time] || 0) + 1;
    });
  } catch (err) {
    console.warn('[getReservationStatsForDate] No se pudo leer asistencias legacy:', err);
  }

  return { byClassId, byTimeNew, legacyByTime };
}

function getReservationCountForBlock(stats, block, fallbackTime) {
  if (!stats) return 0;
  const { byClassId, byTimeNew, legacyByTime } = stats;

  const classId = (block && (block.id || block.classId)) || null;
  const time    = fallbackTime || (block && block.startTime) || null;

  let base = 0;

  if (classId && Object.prototype.hasOwnProperty.call(byClassId, classId)) {
    base = byClassId[classId];
  } else if (time && Object.prototype.hasOwnProperty.call(byTimeNew, time)) {
    base = byTimeNew[time];
  }

  let legacy = 0;
  if (time && legacyByTime && Object.prototype.hasOwnProperty.call(legacyByTime, time)) {
    legacy = legacyByTime[time];
  }

  return base + legacy;
}

/**
 * Rellena textos de cupos en las tarjetas del modal de selección.
 */
async function populateCapacityInfoForDate(dateStr, blocks, modalEl) {
  try {
    const stats = await getReservationStatsForDate(dateStr);

    blocks.forEach((block, idx) => {
      const card   = modalEl.querySelector(`.schedule-class-card[data-idx="${idx}"]`);
      if (!card) return;

      const infoEl = card.querySelector('.class-slot-capacity');
      const btn    = card.querySelector('.class-slot-cta');

      const minCap = normalizeCapacity(block.minCapacity);
      const maxCap = normalizeCapacity(block.maxCapacity);
      const count  = getReservationCountForBlock(stats, block, block.startTime);

      if (infoEl) {
        let msg = '';

        if (maxCap) {
          const free = Math.max(maxCap - count, 0);
          msg = `${count} reservados · ${free} libres`;
        } else {
          msg = `${count} reservados`;
        }

        if (minCap) {
          msg += ` (mín. ${minCap})`;
        }

        let statusHtml = '';
        if (minCap) {
          const missing = Math.max(minCap - count, 0);
          if (missing <= 0) {
            statusHtml = '<span class="class-slot-status class-slot-confirmed">Clase confirmada</span>';
          } else {
            statusHtml = `<span class="class-slot-status class-slot-pending">Faltan ${missing} para confirmar</span>`;
          }
        }

        infoEl.innerHTML = statusHtml ? `${msg}<br>${statusHtml}` : msg;
      }

      if (btn && maxCap && count >= maxCap) {
        btn.disabled = true;
        btn.textContent = 'Clase llena';
        card.classList.add('slot-full');
      }
    });
  } catch (err) {
    console.error('[client] Error cargando cupos:', err);
  }
}

/**
 * Calcula ocupación por día en un rango [start, end) para pintar el calendario.
 */
async function recomputeDayOccupancyForRange(startDateStr, endDateStr) {
  try {
    const q = query(
      collection(db, 'reservations'),
      where('date', '>=', startDateStr),
      where('date', '<',  endDateStr)
    );
    const snap = await getDocs(q);

    const byDate = {};
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const date = data.date;
      if (!date) return;
      if (date < startDateStr || date >= endDateStr) return;
      (byDate[date] ??= []).push(data);
    });

    const map = {};

    Object.entries(byDate).forEach(([dateStr, reservations]) => {
      const blocksForDay = getBlocksForDate(dateStr);
      if (!blocksForDay.length) return;

      let totalSlots = 0;
      let fullSlots  = 0;
      let occupied   = 0;
      let totalCap   = 0;

      blocksForDay.forEach(block => {
        const maxCap = normalizeCapacity(block.maxCapacity);
        if (!maxCap) return;

        totalSlots++;
        totalCap += maxCap;

        const count = reservations.filter(r =>
          (r.classId && (r.classId === block.id || r.classId === block.classId)) ||
          (!r.classId && r.time === block.startTime)
        ).length;

        occupied += count;
        if (count >= maxCap) fullSlots++;
      });

      if (!totalSlots) return;

      const ratio = totalCap > 0 ? occupied / totalCap : 0;
      const full  = fullSlots === totalSlots;
      const busy  = !full && ratio >= 0.7;

      if (full || busy) {
        map[dateStr] = { full, busy };
      }
    });

    dayOccupancyMap = map;
  } catch (err) {
    console.error('[client] Error calculando ocupación diaria:', err);
    dayOccupancyMap = {};
  }
}

/* ───────── Sizing del deck ───────── */
let _sizeDeckTimer = null;
function sizeDeckNow() {
  const deck = document.getElementById('calendarDeck');
  if (!deck) return;
  const isProf = deck.dataset.mode === 'prof';
  const face   = deck.querySelector(isProf ? '.face-prof' : '.face-student');
  if (!face) return;

  const inner = face.querySelector('.fc') || face.firstElementChild;
  const h = (inner?.offsetHeight || face.offsetHeight || 0);
  deck.style.height = h ? `${h}px` : '';
}
function sizeDeckSoon() { clearTimeout(_sizeDeckTimer); _sizeDeckTimer = setTimeout(sizeDeckNow, 60); }
function queueSizeDeck() { sizeDeckSoon(); }

/* ───────── Flip 3D ───────── */
function flipDeck(toProf) {
  const deck = document.getElementById('calendarDeck');
  if (!deck) return;

  deck.classList.add('toggling');
  deck.setAttribute('data-mode', toProf ? 'prof' : 'student');

  const done = () => {
    deck.classList.remove('toggling');
    deck.removeEventListener('transitionend', done, true);
    if (toProf) { calStaff?.updateSize(); } else { calStudent?.updateSize(); }
    queueSizeDeck();
  };
  const safety = setTimeout(done, 520);
  deck.addEventListener('transitionend', () => { clearTimeout(safety); done(); }, true);
}

/* ───────── Calendario Estudiante ───────── */
function buildStudentCalendar(holderEl) {
  if (!holderEl) return;
  if (unsubStudent) { try { unsubStudent(); } catch {} unsubStudent = null; }
  if (calStudent)   { try { calStudent.destroy(); } catch {} calStudent = null; }
  holderEl.innerHTML = '';

  calStudent = new FullCalendar.Calendar(holderEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    firstDay: 1,
    timeZone: CR_TZ,
    headerToolbar: { left: '', center: 'title', right: '' },
    height: 'auto',
    contentHeight: 'auto',
    expandRows: true,
    handleWindowResize: true,

    events(info, success, failure) {
      const start = info.startStr.slice(0, 10);
      const end   = info.endStr.slice(0, 10);
      const myQ   = query(collection(db, 'reservations'), where('userId', '==', auth.currentUser.uid));

      if (unsubStudent) { try { unsubStudent(); } catch {} unsubStudent = null; }

      unsubStudent = onSnapshot(myQ, snap => {
        (async () => {
          try {
            const evs = snap.docs.map(d => {
              const r = d.data();
              const date = r.date;
              if (!date || date < start || date >= end) return null;
              return {
                id: d.id,
                title: 'Reserva',
                start: date,
                allDay: true,
                extendedProps: {
                  time: r.time,
                  classType: r.classType || r.type || '',
                  professorName: r.professorName || ''
                }
              };
            }).filter(Boolean);

            // Cargamos excepciones y ocupación para el rango visible
            await loadCalendarExceptionsForRange(start, end);
            await recomputeDayOccupancyForRange(start, end);

            success(evs);
            queueSizeDeck();
          } catch (err) {
            console.error(err);
            failure(err);
          }
        })();
      }, err => { console.error(err); failure(err); });

      return () => { if (unsubStudent) { try { unsubStudent(); } catch {} unsubStudent = null; } };
    },

    eventContent() {
      return { html: '<div style="font-size:20px;text-align:center;">✅</div>' };
    },

    async dateClick(info) {
      const dateStr = info.dateStr.slice(0, 10);

      if (!isDateInCurrentMonthCR(dateStr)) {
        showAlert('Solo puedes reservar en el mes actual.', 'error');
        return;
      }

      // Asegurarnos de tener excepciones frescas (por si cambió algo)
      await loadCalendarExceptionsForRange(dateStr, dateStr);

      const ex = calendarExceptionsMap[dateStr];
      if (ex && ex.action === 'block') {
        const msg = ex.reason
          ? `No hay clases en este día: ${ex.reason}`
          : 'No hay clases en este día.';
        showAlert(msg, 'error');
        return;
      }

      const dayBlocks = getBlocksForDate(dateStr);
      if (!dayBlocks.length) {
        showAlert('No hay clases disponibles en este día.', 'error');
        return;
      }

      openClassSelectionModal(dateStr, dayBlocks);
    },

    eventClick(info) {
      const dateStr = info.event.startStr.slice(0, 10);
      const timeStr = info.event.extendedProps.time;
      if (!timeStr) {
        showAlert('No se pudo obtener la hora de la reserva.', 'error');
        return;
      }
      if (!canCancel(dateStr, timeStr)) {
        showAlert('No puedes cancelar durante o después de la clase.', 'error');
        return;
      }
      openDeleteReservationModal(info.event.id, dateStr, timeStr, info.event.extendedProps);
    },

    dayCellClassNames(arg) {
      const classes = [];

      const dateStr = arg.dateStr ? arg.dateStr.slice(0, 10) : arg.date.toISOString().slice(0, 10);
      const ex      = calendarExceptionsMap[dateStr];

      const dow        = arg.date.getUTCDay();
      const hasBaseDay = availableDaysSet && availableDaysSet.has(dow);

      // Día bloqueado por excepción → se marca como bloqueado y deshabilitado
      if (ex?.action === 'block') {
        classes.push('day-blocked', 'disabled-day');
      } else {
        // Si no hay horario base y tampoco excepción override/add → deshabilitado
        const hasExceptionSlots = ex && (ex.action === 'override' || ex.action === 'add');
        if (!hasBaseDay && !hasExceptionSlots) {
          classes.push('disabled-day');
        }

        if (ex?.action === 'override') {
          classes.push('day-override');
        } else if (ex?.action === 'add') {
          classes.push('day-add');
        }
      }

      const meta = dayOccupancyMap[dateStr];
      if (meta?.full) {
        classes.push('day-full');
      } else if (meta?.busy) {
        classes.push('day-busy');
      }

      return classes;
    }
  });

  requestAnimationFrame(() => {
    calStudent.render();
    setTimeout(() => { calStudent.updateSize(); queueSizeDeck(); }, 40);
  });
}

/* ───────── Calendario Profesor ───────── */
function buildStaffCalendar(holderEl) {
  if (!holderEl) return;
  ensureAttendancePopup();

  if (unsubStaff) { try { unsubStaff(); } catch {} unsubStaff = null; }
  if (calStaff)   { try { calStaff.destroy(); } catch {} calStaff = null; }
  holderEl.innerHTML = '';

  calStaff = new FullCalendar.Calendar(holderEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    firstDay: 1,
    timeZone: CR_TZ,
    headerToolbar: { left: '', center: 'title', right: '' },
    height: 'auto',
    contentHeight: 'auto',
    expandRows: true,
    handleWindowResize: true,

    events(info, success, failure) {
      const start = info.startStr.slice(0, 10);
      const end   = info.endStr.slice(0, 10);
      const qAll  = query(collection(db, 'reservations'));

      if (unsubStaff) { try { unsubStaff(); } catch {} unsubStaff = null; }

      unsubStaff = onSnapshot(qAll, snap => {
        (async () => {
          try {
            const byDate = {};
            snap.forEach(d => {
              const data = d.data();
              if (!data.date) return;
              if (data.date < start || data.date >= end) return;
              byDate[data.date] ??= [];
              byDate[data.date].push(data.nombre || 'Desconocido');
            });
            const list = Object.entries(byDate).map(([date, names]) => ({
              title: `${names.length}`,
              start: date,
              allDay: true,
              extendedProps: { names, count: names.length }
            }));

            await loadCalendarExceptionsForRange(start, end);
            await recomputeDayOccupancyForRange(start, end);

            success(list);
            queueSizeDeck();
          } catch (err) {
            console.error(err);
            failure(err);
          }
        })();
      }, err => { console.error(err); failure(err); });

      return () => { if (unsubStaff) { try { unsubStaff(); } catch {} unsubStaff = null; } };
    },

    eventMouseEnter: info => {
      const modalActive = document.getElementById('attModal')?.classList.contains('active');
      if (modalActive) return;
      const tip = document.createElement('div');
      tip.className = 'custom-tooltip';
      tip.innerHTML = `<strong>Usuarios:</strong><br>${(info.event.extendedProps.names || []).join('<br>')}`;
      document.body.appendChild(tip);
      const move = e => { tip.style.left = `${e.pageX + 10}px`; tip.style.top = `${e.pageY + 10}px`; };
      const cleanup = () => tip.remove();
      info.el.addEventListener('mousemove', move);
      info.el.addEventListener('mouseleave', cleanup);
      info.el.addEventListener('click', cleanup);
    },

    eventClick: async info => {
      killTooltips();
      const day  = info.event.startStr.slice(0, 10);
      const list = await getReservasPorDia(day);
      openAttendancePopup(list, day);
    },

    dayCellClassNames(arg) {
      const classes = [];

      const dateStr = arg.dateStr ? arg.dateStr.slice(0, 10) : arg.date.toISOString().slice(0, 10);
      const ex      = calendarExceptionsMap[dateStr];

      const dow        = arg.date.getUTCDay();
      const hasBaseDay = availableDaysSet && availableDaysSet.has(dow);

      if (ex?.action === 'block') {
        classes.push('day-blocked', 'disabled-day');
      } else {
        const hasExceptionSlots = ex && (ex.action === 'override' || ex.action === 'add');
        if (!hasBaseDay && !hasExceptionSlots) {
          classes.push('disabled-day');
        }

        if (ex?.action === 'override') {
          classes.push('day-override');
        } else if (ex?.action === 'add') {
          classes.push('day-add');
        }
      }

      const meta = dayOccupancyMap[dateStr];
      if (meta?.full) {
        classes.push('day-full');
      } else if (meta?.busy) {
        classes.push('day-busy');
      }

      return classes;
    }
  });

  requestAnimationFrame(() => {
    calStaff.render();
    setTimeout(() => { calStaff.updateSize(); queueSizeDeck(); }, 40);
  });
}

/* ───────── CRUD de reservas (estudiante) ───────── */
async function addReservation(date, time, slotMeta) {
  try {
    const userRef  = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showAlert('Perfil no encontrado.', 'error');
      return null;
    }

    const userData = userSnap.data();

    // Admin / Dev están siempre autorizados (reglas de negocio).
    const roles = Array.isArray(userData.roles) ? userData.roles : [];
    const isAdminOrDev = roles.includes('admin') || roles.includes('dev');

    if (!isAdminOrDev && (!userData.autorizado || userData.banned === true)) {
      showAlert('Tu cuenta no está autorizada para reservar clases.', 'error');
      return null;
    }

    const dupQ    = query(collection(db, 'reservations'), where('userId', '==', auth.currentUser.uid));
    const dupSnap = await getDocs(dupQ);

    const alreadyReserved = dupSnap.docs.some(d => {
      const r = d.data() || {};
      return r.date === date && r.time === time;
    });

    if (alreadyReserved) {
      showAlert('Ya tienes una reserva para este horario.', 'error');
      return null;
    }

    const maxCap = slotMeta ? normalizeCapacity(slotMeta.maxCapacity) : null;
    if (maxCap) {
      const stats        = await getReservationStatsForDate(date);
      const currentCount = getReservationCountForBlock(stats, slotMeta, time);

      if (currentCount >= maxCap) {
        showAlert('Este horario ya está lleno. No se pueden crear más reservas.', 'error');
        return null;
      }
    }

    const slotTs = Timestamp.fromDate(crDateTime(date, time));

    const reservationData = {
      date,
      time,
      slotTs,
      userId: auth.currentUser.uid,
      user:   auth.currentUser.email,
      nombre: userData.nombre || '',
    };

    if (slotMeta) {
      reservationData.classId       = slotMeta.id || slotMeta.classId || null;
      reservationData.classType     = slotMeta.type || slotMeta.classType || slotMeta.colorKey || null;
      reservationData.professorId   = slotMeta.professorId || null;
      reservationData.professorName = slotMeta.professorName || null;
    }

    const docRef = await addDoc(collection(db, 'reservations'), reservationData);

    const attendanceData = {
      nombre:   userData.nombre || '',
      hora:     time,
      presente: false,
    };

    if (slotMeta) {
      attendanceData.classId = slotMeta.id || slotMeta.classId || null;
    }

    const attendanceId = `${auth.currentUser.uid}_${time.replace(':', '-')}`;

    await setDoc(
      doc(db, 'asistencias', date, 'usuarios', attendanceId),
      attendanceData,
      { merge: true }
    );

    return docRef.id;
  } catch (err) {
    console.error('[addReservation] Error:', err);
    showAlert('Error guardando reserva.', 'error');
    throw err;
  }
}

async function deleteReservation(resId, dateHint, timeHint) {
  showLoader();
  try {
    calStudent?.getEventById(resId)?.remove();

    let date = dateHint;
    let time = timeHint;

    if (!date || !time) {
      const ref  = doc(db, 'reservations', resId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (!date) date = data.date;
        if (!time) time = data.time;
      }
    }

    await deleteDoc(doc(db, 'reservations', resId));

    if (date && time) {
      const attendanceIdNew = `${auth.currentUser.uid}_${time.replace(':', '-')}`;

      try {
        await deleteDoc(doc(db, 'asistencias', date, 'usuarios', attendanceIdNew));
      } catch (e) {
        console.warn('[deleteReservation] No se pudo borrar asistencia nueva:', e);
      }

      try {
        await deleteDoc(doc(db, 'asistencias', date, 'usuarios', auth.currentUser.uid));
      } catch (e) {
        console.warn('[deleteReservation] No se pudo borrar asistencia vieja:', e);
      }
    } else if (date) {
      try {
        await deleteDoc(doc(db, 'asistencias', date, 'usuarios', auth.currentUser.uid));
      } catch (e) {
        console.warn('[deleteReservation] No se pudo borrar asistencia (solo fecha):', e);
      }
    }

    showAlert('Reserva eliminada', 'success');
  } catch (err) {
    console.error(err);
    showAlert('Error eliminando reserva.', 'error');
  } finally {
    hideLoader();
  }
}

/* ───────── Modales (estudiante) ───────── */
function openClassSelectionModal(dateStr, blocks) {
  closeModal();
  const prettyDate = formatLongDate(dateStr);

  const m = document.createElement('div');
  m.className = 'class-select-modal';
  m.innerHTML = `
    <div class="class-select-content">
      <h2 class="class-select-title">Clases disponibles</h2>
      <p class="class-select-subtitle">${prettyDate}</p>
      <div class="class-select-list">
        ${
          blocks.map((b, idx) => `
            <article class="schedule-class-card" data-idx="${idx}">
              <div class="class-slot-time">${formatRange12(b.startTime, b.endTime)}</div>
              <div class="class-slot-tag">${b.type || 'Clase'}</div>
              <div class="class-slot-prof">
                Profesor: <strong>${b.professorName || 'Por confirmar'}</strong>
              </div>
              <div class="class-slot-capacity">Cargando cupos...</div>
              <button class="btn class-slot-cta">Reservar en este horario</button>
            </article>
          `).join('')
        }
      </div>
      <button class="btn error class-select-close">Cerrar</button>
    </div>
  `;
  document.body.appendChild(m);

  m.querySelectorAll('.schedule-class-card').forEach(card => {
    const idx   = Number(card.dataset.idx);
    const block = blocks[idx];
    const btn   = card.querySelector('.class-slot-cta');
    if (!btn) return;

    btn.addEventListener('click', () => {
      openConfirmReservationModal(dateStr, block);
    });
  });

  m.querySelector('.class-select-close')?.addEventListener('click', () => m.remove());
  m.addEventListener('click', (e) => {
    if (e.target === m) m.remove();
  });

  populateCapacityInfoForDate(dateStr, blocks, m);
}

function openConfirmReservationModal(date, block) {
  closeModal();
  const prettyDate = formatLongDate(date);
  const time12     = formatTime12(block.startTime);

  const m = document.createElement('div');
  m.className = 'custom-modal';
  m.innerHTML = `
    <div class="modal-content confirm-modal">
      <p>
        <strong>¿Confirmar reserva para el</strong><br>
        <span class="confirm-date">${prettyDate}</span><br>
        a las <strong>${time12}</strong><br>
        <span class="confirm-extra">(${block.type || 'Clase'} - ${block.professorName || 'Profesor'})</span>
      </p>
      <div class="modal-actions">
        <button id="confirmBtn" class="btn">Confirmar</button>
        <button id="cancelBtn" class="btn error">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  const confirmBtn = document.getElementById('confirmBtn');
  const cancelBtn  = document.getElementById('cancelBtn');

  confirmBtn.onclick = async () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    cancelBtn.disabled  = true;
    confirmBtn.classList.add('is-loading');

    try {
      const check = canBook(date, block.startTime);
      if (!check.ok) {
        showAlert(
          check.reason === 'lt1h'
            ? 'Para hoy solo puedes reservar hasta 1 hora antes.'
            : 'No puedes reservar durante o después de la clase.',
          'error'
        );
        return;
      }

      showLoader();

      const uDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!uDoc.exists()) {
        showAlert('Usuario no encontrado.', 'error');
        return;
      }
      const uData = uDoc.data();

      const roles = Array.isArray(uData.roles) ? uData.roles : [];
      const isAdminOrDev = roles.includes('admin') || roles.includes('dev');
      const isAuthorized = isAdminOrDev || (uData.autorizado === true && uData.banned !== true);

      if (!isAuthorized) {
        showAlert('Tu cuenta no está autorizada para reservar clases.', 'error');
        return;
      }

      const newId = await addReservation(date, block.startTime, block);
      if (!newId) return;

      showAlert('Reserva confirmada', 'success');

      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (e) {
      console.error(e);
      showAlert('Error confirmando reserva.', 'error');
    } finally {
      confirmBtn.classList.remove('is-loading');
      confirmBtn.disabled = false;
      cancelBtn.disabled  = false;
      hideLoader();
      closeModal();
    }
  };

  cancelBtn.onclick = () => closeModal();
}

function openDeleteReservationModal(resId, date, time, extra = {}) {
  closeModal();
  const prettyDate = formatLongDate(date);
  const time12     = formatTime12(time);
  const detailType = extra.classType || extra.type || '';
  const profName   = extra.professorName || '';

  const detail = detailType
    ? ` (${detailType}${profName ? ' - ' + profName : ''})`
    : '';

  const m = document.createElement('div');
  m.className = 'custom-modal';
  m.innerHTML = `
    <div class="modal-content confirm-modal">
      <p>
        ¿Eliminar reserva del<br>
        <strong>${prettyDate}</strong><br>
        a las <strong>${time12}</strong>${detail}?
      </p>
      <div class="modal-actions">
        <button id="deleteBtn" class="btn error">Eliminar</button>
        <button id="cancelDeleteBtn" class="btn">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  document.getElementById('deleteBtn').onclick = async () => {
    if (!canCancel(date, time)) {
      showAlert('No puedes cancelar durante o después de la clase.', 'error');
      closeModal();
      return;
    }
    try {
      await deleteReservation(resId, date, time);
    }
    catch {}
    finally { closeModal(); }
  };
  document.getElementById('cancelDeleteBtn').onclick = closeModal;
}

function closeModal() {
  const m = document.querySelector('.custom-modal');
  if (m) m.remove();
  const sel = document.querySelector('.class-select-modal');
  if (sel) sel.remove();
}

/* ───────── Profesor/Admin: asistencia (popup) ───────── */
async function getReservasPorDia(day) {
  const snap = await getDocs(collection(db, 'asistencias', day, 'usuarios'));
  return snap.docs.map(d => {
    const data = d.data() || {};
    return {
      uid: d.id,
      nombre: data.nombre,
      presente: data.presente || false,
      hora: data.hora || '',
      classType: data.classType || '',
      professorName: data.professorName || '',
      classId: data.classId || null
    };
  });
}

function openAttendancePopup(list, day) {
  killTooltips();
  const m = document.getElementById('attModal');
  const l = document.getElementById('attList');
  const d = document.getElementById('attDate');
  if (!m || !l || !d) return;

  d.textContent = formatLongDate(day);
  l.innerHTML = '';

  if (!Array.isArray(list) || !list.length) {
    const empty = document.createElement('p');
    empty.className = 'att-empty';
    empty.textContent = 'No hay reservas para este día.';
    l.appendChild(empty);
    m.classList.add('active');
    return;
  }

  const byHour = {};
  list.forEach(u => {
    const key = u.hora || '';
    (byHour[key] ??= []).push(u);
  });
  const hours = Object.keys(byHour).sort();

  const blocksForDay = getBlocksForDate(day);

  hours.forEach(hora => {
    const group = byHour[hora];
    const hourLabel = hora ? formatTime12(hora) : 'Sin horario';

    const sample = group[0] || {};
    const block = blocksForDay.find(b =>
      (sample.classId && (sample.classId === b.id || sample.classId === b.classId)) ||
      (!sample.classId && b.startTime === hora)
    );

    const minCap = block ? normalizeCapacity(block.minCapacity) : null;
    const maxCap = block ? normalizeCapacity(block.maxCapacity) : null;

    const count = group.length;
    let capText = '';

    if (maxCap) {
      const free = Math.max(maxCap - count, 0);
      capText = `${count} reservados · ${free} libres`;
    } else {
      capText = `${count} reservados`;
    }
    if (minCap) {
      capText += ` (mín. ${minCap})`;
    }

    const header = document.createElement('div');
    header.className = 'att-slot-title';
    header.innerHTML = `
      <div class="att-slot-title-main">Horario ${hourLabel}</div>
      <div class="att-slot-title-capacity">${capText}</div>
    `;
    l.appendChild(header);

    group.forEach(u => {
      const row = document.createElement('div');
      row.className = 'att-item';
      const extra = u.classType ? ` – ${u.classType}` : '';
      row.innerHTML = `
        <input type="checkbox" id="att_${u.uid}" ${u.presente ? 'checked' : ''} />
        <label for="att_${u.uid}" style="flex:1">${u.nombre}${extra}</label>
      `;
      row.querySelector('input').addEventListener('change', async (e) => {
        try {
          await updateDoc(doc(db, 'asistencias', day, 'usuarios', u.uid), { presente: e.target.checked });
          showAlert('Asistencia actualizada', 'success');
        } catch (err) {
          console.error(err);
          showAlert('Error al guardar asistencia', 'error');
        }
      });
      l.appendChild(row);
    });
  });

  m.classList.add('active');
}

/* ───────── Boot ───────── */
document.addEventListener('DOMContentLoaded', () => {
  ensureSidebarRuntimeDefaults();
  bindSidebarOnce();
  bindLogoutOnce();
  bindNavbarActions();

  window.addEventListener('resize', sizeDeckSoon);
  window.addEventListener('orientationchange', sizeDeckSoon);

  const openScannerBtn  = document.getElementById('openScannerBtn');
  const scannerModal    = document.getElementById('scannerModal');
  const btnCloseScanner = document.getElementById('btnCloseScanner');
  if (openScannerBtn && scannerModal && btnCloseScanner) {
    openScannerBtn.addEventListener('click', () => scannerModal.classList.add('active'));
    btnCloseScanner.addEventListener('click', () => scannerModal.classList.remove('active'));
  }

  onAuthStateChanged(auth, async user => {
    if (!user) { location.href = './index.html'; return; }

    let roles    = [];
    let userData = null;
    try {
      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) {
        userData = uSnap.data();
        roles    = userData.roles || [];
      }
    } catch (e) { console.error(e); }

    const isStaff    = roles.includes('professor') || roles.includes('admin') || roles.includes('dev');
    const switchWrap = document.getElementById('roleSwitchWrap');
    const deck       = document.getElementById('calendarDeck');
    const elStudent  = document.getElementById('calendarStudent');
    const elProf     = document.getElementById('calendarProf');

    if (switchWrap) switchWrap.classList.toggle('hidden', !isStaff);

    const codeEl = document.getElementById('attendanceCodeDisplay');
    if (codeEl && userData) {
      codeEl.textContent = `Tu código de asistencia: ${userData.attendanceCode || '—'}`;
    }

    const localTimeEl = document.getElementById('local-time');
    if (localTimeEl) {
      const fmt = new Intl.DateTimeFormat('es-CR', {
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: CR_TZ
      });
      const tick = () => { localTimeEl.textContent = `Hora en Costa Rica: ${fmt.format(new Date())}`; };
      tick();
      setInterval(tick, 1000);
    }

    // Cargar horario base + excepciones antes de dibujar los calendarios
    await Promise.all([
      loadClassScheduleForBookings(),
      loadCalendarExceptions(true)
    ]);

    buildStudentCalendar(elStudent);

    if (isStaff) {
      buildStaffCalendar(elProf);
      const toggle = document.getElementById('modeToggle');
      if (toggle && !toggle.dataset.bound) {
        toggle.addEventListener('change', () => {
          const toProf = !!toggle.checked;
          flipDeck(toProf);
        });
        toggle.dataset.bound = '1';
      }
    } else {
      deck?.setAttribute('data-mode', 'student');
    }

    queueSizeDeck();
  });
});
