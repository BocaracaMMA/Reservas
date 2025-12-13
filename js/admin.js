// ./js/admin.js
// Panel Admin:
// - Sidebar / logout
// - Calendario mensual de reservas
// - Modal de asistencia con botón Compartir
// - Días habilitados leídos desde classSchedule

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

// Fecha larga en español, estilo "viernes, 12 de diciembre de 2025"
function formatLongDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('es-CR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Costa_Rica'
    }).format(base);
  } catch {
    return dateStr;
  }
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

  // Gateo por rol y luego inicializar calendario admin
  (async () => {
    await gateAdminPage();
    await iniciarPanelAdmin();
  })();
});

/* -------------------------------------------------------------------------- */
/* classSchedule → días de la semana con clases activas                       */
/* -------------------------------------------------------------------------- */

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

async function iniciarPanelAdmin() {
  const calendarEl = document.getElementById('calendar-admin');
  if (!calendarEl || !window.FullCalendar) return;

  const enabledDays = await loadEnabledDaysFromSchedule();

  if (!calendarEl.style.minHeight) calendarEl.style.minHeight = '560px';

  const calendar = new window.FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    firstDay: 1,
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

  setTimeout(() => { try { calendar.updateSize(); } catch {} }, 0);
  window.addEventListener('resize', () => {
    try { calendar.updateSize(); } catch {}
  });
}

/* -------------------------------------------------------------------------- */
/* Asistencia                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Lee asistencias para un día concreto:
 *   /asistencias/{day}/usuarios/{uid}
 */
async function getReservasPorDia(day) {
  const snap = await getDocs(collection(db, 'asistencias', day, 'usuarios'));
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      uid: d.id,
      nombre: data.nombre,
      presente: data.presente || false,
      hora: data.hora || ''
    };
  });
}

/**
 * Agrupa las reservas por hora, devolviendo:
 * [{ hour, hourLabel, names[], presence{nombre->bool}, total?, minCap?, maxCap? }]
 */
function groupAttendanceByHour(list) {
  const map = new Map();

  list.forEach((u) => {
    const hour = u.hora || '';
    const key  = hour || 'sin-horario';

    if (!map.has(key)) {
      map.set(key, {
        hour,
        hourLabel: hour ? formatTime12(hour) : 'Sin horario',
        names: [],
        presence: {}
      });
    }

    const slot = map.get(key);
    const name = u.nombre || 'Sin nombre';
    slot.names.push(name);
    slot.presence[name] = !!u.presente;
  });

  return Array.from(map.values()).sort((a, b) =>
    (a.hour || '').localeCompare(b.hour || '')
  );
}

/**
 * Enriquecemos los slots con min/maxCapacity a partir de classSchedule.
 */
async function enrichSlotsWithCapacity(day, slots) {
  try {
    const dt  = new Date(`${day}T12:00:00-06:00`);
    const dow = dt.getUTCDay();

    const snap = await getDocs(collection(db, 'classSchedule'));
    const byHour = {};

    snap.forEach(docSnap => {
      const data  = docSnap.data() || {};
      const active = data.active !== false;
      if (!active) return;

      const bdow = Number(data.dayOfWeek ?? NaN);
      if (!Number.isFinite(bdow) || bdow !== dow) return;

      const startTime = data.startTime;
      if (!startTime) return;

      const maxCap = Number(data.maxCapacity);
      const minCap = Number(data.minCapacity);

      byHour[startTime] = {
        maxCap: Number.isFinite(maxCap) && maxCap > 0 ? maxCap : null,
        minCap: Number.isFinite(minCap) && minCap > 0 ? minCap : null
      };
    });

    slots.forEach(slot => {
      slot.total = slot.names.length;
      const caps = byHour[slot.hour];
      if (caps) {
        slot.maxCap = caps.maxCap;
        slot.minCap = caps.minCap;
      }
    });
  } catch (err) {
    console.warn('[admin] No se pudo cargar capacities para el día', day, err);
    slots.forEach(slot => { slot.total = slot.names.length; });
  }
}

/**
 * Guarda el estado de asistencia para un usuario concreto.
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

/**
 * Abre el popup de asistencia de admin con el mismo look que el modal
 * de profesores/estudiantes y añade el botón Compartir.
 */
function abrirPopupAsistencia(list, day) {
  const overlay = document.getElementById('asistenciaPopup');
  if (!overlay) return;

  const slots = groupAttendanceByHour(list);

  // Plantilla del modal (reutiliza clases .att-*)
  overlay.innerHTML = `
    <div class="att-card">
      <div class="att-head">
        <h3 class="att-title">
          Asistencia para el día:
          <span>${formatLongDate(day)}</span>
        </h3>
        <button type="button" class="close-btn" aria-label="Cerrar"></button>
      </div>
      <div class="att-list"></div>
      <div class="att-footer">
        <button type="button" class="att-share-btn">Compartir</button>
      </div>
    </div>
  `;

  const listEl   = overlay.querySelector('.att-list');
  const shareBtn = overlay.querySelector('.att-share-btn');
  const closeBtn = overlay.querySelector('.close-btn');

  listEl.innerHTML = '';

  if (!slots.length) {
    const p = document.createElement('p');
    p.className = 'att-empty';
    p.textContent = 'No hay reservas para este día.';
    listEl.appendChild(p);
  } else {
    slots.forEach(slot => {
      // Cabecera de horario
      const header = document.createElement('div');
      header.className = 'att-slot-title';

      const main = document.createElement('div');
      main.className = 'att-slot-title-main';
      main.textContent = `Horario ${slot.hourLabel}`;

      const cap = document.createElement('div');
      cap.className = 'att-slot-title-capacity';
      cap.textContent = `${slot.names.length} reservas`;

      header.append(main, cap);
      listEl.appendChild(header);

      // Guardamos referencia para actualizar luego con cupos reales
      slot._capEl = cap;

      // Filas de usuarios
      slot.names.forEach(name => {
        const row = document.createElement('div');
        row.className = 'att-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!slot.presence[name];

        // Buscamos el registro correspondiente para actualizar Firestore
        const record = list.find(u =>
          (u.nombre || 'Sin nombre') === name &&
          (u.hora || '') === slot.hour
        );

        if (record) {
          cb.addEventListener('change', () => {
            guardarAsistencia(day, record.uid, cb.checked);
          });
        }

        const label = document.createElement('label');
        label.style.flex = '1';
        label.textContent = name;

        row.append(cb, label);
        listEl.appendChild(row);
      });
    });

    // Enriquecemos con min/maxCapacity y actualizamos los textos
    enrichSlotsWithCapacity(day, slots).then(() => {
      slots.forEach(slot => {
        if (!slot._capEl) return;
        const n = slot.total ?? slot.names.length;
        let text = `${n} reservados`;
        if (slot.maxCap) {
          const free = Math.max(slot.maxCap - n, 0);
          text = `${n} reservados · ${free} libres`;
        }
        if (slot.minCap) {
          text += ` (mín. ${slot.minCap})`;
        }
        slot._capEl.textContent = text;
      });
    }).catch(() => {});
  }

  const closeOverlay = () => {
    overlay.classList.remove('active');
  };

  closeBtn?.addEventListener('click', closeOverlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });

  shareBtn?.addEventListener('click', async () => {
    if (!slots.length) {
      showAlert('No hay datos para compartir.', 'error');
      return;
    }
    shareBtn.disabled = true;
    try {
      await shareAdminAttendanceCard();
    } finally {
      shareBtn.disabled = false;
    }
  });

  overlay.classList.add('active');
}

/**
 * Captura el modal de asistencia de admin y lo comparte como imagen
 * (mismo estilo que el modal real).
 */
async function shareAdminAttendanceCard() {
  const card = document.querySelector('#asistenciaPopup .att-card');
  if (!card) {
    showAlert('No se encontró el contenido para compartir.', 'error');
    return;
  }

  if (typeof html2canvas !== 'function') {
    showAlert('No se pudo cargar el generador de imágenes.', 'error');
    return;
  }

  try {
    const canvas = await html2canvas(card, {
      backgroundColor: null,
      scale: window.devicePixelRatio || 2
    });

    const dataUrl = canvas.toDataURL('image/png');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileName = `asistencia-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Asistencia de clase',
        text: 'Resumen de reservas y asistencia generado desde Bocaraca.'
      });
    } else {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showAlert('Imagen descargada. Puedes compartirla desde tu galería.', 'success');
    }
  } catch (err) {
    console.error('[admin] Error al compartir asistencia:', err);
    showAlert('No se pudo generar la imagen para compartir.', 'error');
  }
}

