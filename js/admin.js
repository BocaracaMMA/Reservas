// ./js/admin.js
// Lógica común del panel admin:
// - Navbar / sidebar
// - Logout
// - Calendario mensual de reservas + asistencia
// - Días bloqueados leídos desde classSchedule (admin-calendario)

import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const onReady = (fn) => {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
};

// Formato 12h para tiempos "HH:MM"
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

/* -------------------------------------------------------------------------- */
/* Bootstrap de la página admin                                               */
/* -------------------------------------------------------------------------- */

onReady(() => {
  // Sidebar toggle
  const toggleBtn = document.getElementById('toggleNav');
  const sidebar   = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      try { window.dispatchEvent(new Event('resize')); } catch {}
    });
  }

  // Iconos lucide (si están cargados)
  if (window.lucide) window.lucide.createIcons();

  // Logout desde el sidebar
  document.getElementById('logoutSidebar')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      showAlert('Has cerrado sesión', 'success');
      setTimeout(() => { location.href = './index.html'; }, 900);
    } catch {
      showAlert('Hubo un problema al cerrar sesión.', 'error');
    }
  });

  // Cerrar popup de asistencia (X)
  document.getElementById('cerrarPopupBtn')?.addEventListener('click', () => {
    document.getElementById('asistenciaPopup')?.classList.remove('active');
  });

  // Gateo por rol y luego inicializar calendario admin (si existe en la página)
  (async () => {
    await gateAdminPage();
    await iniciarPanelAdmin();
  })();
});

/* -------------------------------------------------------------------------- */
/* classSchedule → días de la semana con clases activas                       */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve un Set<number> con los días (0–6) que tienen clases
 * activas en la colección classSchedule (permanentes o no).
 *
 * Si no hay datos o hay error, se devuelve un fallback con todos
 * los días habilitados, para no bloquear el calendario.
 */
async function loadEnabledDaysFromSchedule() {
  const fallback = new Set([0, 1, 2, 3, 4, 5, 6]); // todos los días habilitados

  try {
    const snap = await getDocs(collection(db, 'classSchedule'));
    const set = new Set();

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const isActive = d.active !== false;
      if (!isActive) return;

      const dow = Number(d.dayOfWeek ?? NaN);
      if (!Number.isNaN(dow)) set.add(dow);
    });

    if (set.size === 0) return fallback;
    return set;
  } catch (err) {
    console.error('[admin] No se pudo leer classSchedule:', err);
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* FullCalendar admin (mensual)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Calendario mensual que muestra cuántas reservas hay por día y permite
 * abrir el popup de asistencia. Ahora respeta los días habilitados desde
 * classSchedule (los demás se marcan como disabled-day).
 */
async function iniciarPanelAdmin() {
  const calendarEl = document.getElementById('calendar-admin');
  if (!calendarEl || !window.FullCalendar) return;

  // Días de la semana con clases activas (cualquier tipo)
  const enabledDays = await loadEnabledDaysFromSchedule();

  // Altura mínima razonable para móvil
  if (!calendarEl.style.minHeight) calendarEl.style.minHeight = '560px';

  const calendar = new window.FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    firstDay: 1,                // Lunes como primer día de la semana
    initialView: 'dayGridMonth',
    height: 'auto',
    expandRows: true,
    contentHeight: 'auto',
    headerToolbar: { left: '', center: 'title', right: '' },

    // Eventos: número de reservas por día
    events(info, success, failure) {
      const q = query(collection(db, 'reservations'));

      const unsub = onSnapshot(
        q,
        (snap) => {
          try {
            const byDate = {};
            snap.forEach((d) => {
              const data = d.data();
              if (!data?.date) return;
              (byDate[data.date] ??= []).push(data.nombre || 'Desconocido');
            });

            const evs = Object.entries(byDate).map(([date, names]) => ({
              title: String(names.length),
              start: date,
              allDay: true,
              extendedProps: { names }
            }));

            success(evs);
          } catch (err) {
            console.error('[admin] Error construyendo eventos de reservas:', err);
            failure(err);
          }
        },
        (err) => {
          console.error('[admin] Error en snapshot de reservas:', err);
          failure(err);
        }
      );

      // Cleanup cuando FullCalendar lo necesite
      return () => { try { unsub(); } catch {} };
    },

    // Click en un día con reservas → popup de asistencia
    eventClick: async (info) => {
      const day  = info.event.startStr.slice(0, 10);
      const list = await getReservasPorDia(day);
      abrirPopupAsistencia(list, day);
    },

    // Tooltip con nombres al pasar el mouse (solo escritorio)
    eventMouseEnter: (info) => {
      const names = info.event.extendedProps.names || [];
      if (!names.length) return;

      const tip = document.createElement('div');
      tip.className = 'custom-tooltip';
      tip.style.cssText =
        'position:fixed; z-index:10001; background:#0b2540; color:#b4d7ff; border:1px solid #1e3a5f; padding:6px 8px; border-radius:8px; pointer-events:none;';
      tip.innerHTML = `<strong>Usuarios:</strong><br>${names.join('<br>')}`;
      document.body.appendChild(tip);

      const move = (e) => {
        tip.style.left = `${e.pageX + 10}px`;
        tip.style.top  = `${e.pageY + 10}px`;
      };
      const cleanup = () => { try { tip.remove(); } catch {} };

      info.el.addEventListener('mousemove', move);
      info.el.addEventListener('mouseleave', cleanup, { once: true });
      info.el.addEventListener('click',     cleanup, { once: true });
    },

    // Días bloqueados: todo lo que no tenga ninguna clase activa
    dayCellClassNames: (arg) =>
      enabledDays.has(arg.date.getDay()) ? [] : ['disabled-day']
  });

  calendar.render();

  // Ajuste de tamaño por si el sidebar cambia el ancho
  setTimeout(() => { try { calendar.updateSize(); } catch {} }, 0);
  window.addEventListener('resize', () => {
    try { calendar.updateSize(); } catch {}
  });
}

/* -------------------------------------------------------------------------- */
/* Asistencia                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Lee asistencias para un día concreto desde:
 *   /asistencias/{day}/usuarios/{uid}
 * Incluye hora y tipo de clase para poder agrupar.
 */
async function getReservasPorDia(day) {
  const snap = await getDocs(collection(db, 'asistencias', day, 'usuarios'));
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      uid: d.id,
      nombre: data.nombre,
      presente: data.presente || false,
      hora: data.hora || '',
      classType: data.classType || '',
      professorName: data.professorName || ''
    };
  });
}

/**
 * Pinta la lista de usuarios en el popup y permite marcar asistencia.
 * Agrupa por hora de clase para manejar varios horarios en el mismo día.
 */
function abrirPopupAsistencia(list, day) {
  const popup = document.getElementById('asistenciaPopup');
  const ul    = document.getElementById('listaUsuarios');
  const fd    = document.getElementById('fechaReserva');
  if (!popup || !ul || !fd) return;

  ul.innerHTML = '';
  fd.textContent = day;

  const sorted = [...list].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  let lastHour = null;

  sorted.forEach((u) => {
    const hourLabel = u.hora ? formatTime12(u.hora) : null;

    // Cabecera de horario cuando cambia la hora
    if (hourLabel && hourLabel !== lastHour) {
      const headerLi = document.createElement('li');
      headerLi.className = 'asistencia-slot-title';
      headerLi.textContent = `Horario ${hourLabel}`;
      ul.appendChild(headerLi);
      lastHour = hourLabel;
    }

    const li = document.createElement('li');
    li.className = 'asistencia-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = u.presente;
    cb.id = u.uid;
    cb.addEventListener('change', () =>
      guardarAsistencia(day, u.uid, cb.checked)
    );

    const span = document.createElement('span');
    const extra = u.classType ? ` – ${u.classType}` : '';
    span.textContent = `${u.nombre}${extra}`;

    li.append(cb, span);
    ul.append(li);
  });

  popup.classList.add('active');
}

/**
 * Guarda el estado de asistencia de un usuario para un día concreto.
 */
async function guardarAsistencia(day, uid, presente) {
  try {
    await updateDoc(doc(db, 'asistencias', day, 'usuarios', uid), { presente });
    showAlert('Asistencia actualizada', 'success');
  } catch (err) {
    console.error('[admin] Error al guardar asistencia:', err);
    showAlert('Error al guardar asistencia', 'error');
  }
}

/* -------------------------------------------------------------------------- */
/* Cerrar popup de asistencia (overlay + ESC)                                 */
/* -------------------------------------------------------------------------- */
(() => {
  const overlay  = document.getElementById('asistenciaPopup');
  const btnClose = document.getElementById('cerrarPopupBtn');
  if (!overlay || !btnClose) return;

  const close = () => overlay.classList.remove('active');

  // Botón X
  btnClose.addEventListener('click', close);

  // Clic fuera de la tarjeta
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });
})();
