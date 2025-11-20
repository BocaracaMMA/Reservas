// ./js/admin-reportes.js
import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

//
// ─────────────────────────────────────────────────────────────
// UTILIDADES PARA RENDERIZAR
// ─────────────────────────────────────────────────────────────

// Genera el HTML de la tarjeta + tabla para una fecha concreta
function generarTablaPorFecha(fecha, data) {
  const total     = data.length;
  const presentes = data.filter(u => u.presente).length;
  const ausentes  = total - presentes;

  let tableHTML = `
    <article class="report-day-card">
      <header class="report-day-header">
        <div class="report-day-title">
          <i class="bi bi-calendar-event"></i>
          <span>Asistencia · ${fecha}</span>
        </div>
        <div class="report-day-summary">
          ${presentes} presentes · ${ausentes} ausentes · ${total} registros
        </div>
      </header>
      <div class="report-day-body">
        <table class="asistencia-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Hora</th>
              <th>Presente</th>
            </tr>
          </thead>
          <tbody>
  `;

  data.forEach((user) => {
    tableHTML += `
      <tr>
        <td>${user.nombre}</td>
        <td>${user.hora}</td>
        <td>${user.presente ? "✅" : "❌"}</td>
      </tr>
    `;
  });

  tableHTML += `
          </tbody>
        </table>
      </div>
    </article>
  `;
  return tableHTML;
}

// Renderiza/actualiza la tarjeta de un día concreto
function renderizarTablaEnDOM(fecha, asistenciaData) {
  const container = document.getElementById("reporte-container");
  if (!container) return;

  const wrapperId = `tabla-${fecha.replace(/:/g, "-")}`;

  let wrapper = document.getElementById(wrapperId);
  if (wrapper) {
    wrapper.innerHTML = generarTablaPorFecha(fecha, asistenciaData);
  } else {
    wrapper = document.createElement("div");
    wrapper.id = wrapperId;
    wrapper.classList.add("report-day-wrapper");
    wrapper.innerHTML = generarTablaPorFecha(fecha, asistenciaData);
    container.appendChild(wrapper);
  }
}

// Elimina la tarjeta de una fecha (cuando deja de pertenecer al mes)
function eliminarTablaDeDOM(fecha) {
  const wrapperId = `tabla-${fecha.replace(/:/g, "-")}`;
  const wrapper = document.getElementById(wrapperId);
  if (wrapper) wrapper.remove();
}

//
// ─────────────────────────────────────────────────────────────
// LÓGICA EN TIEMPO REAL
// ─────────────────────────────────────────────────────────────

let subUnsubsUsuarios = {};
let unsubscribeAsistencias = null;

// Rellena el select de año con un pequeño rango [Año-2, Año+1]
function initYearSelect() {
  const sel = document.getElementById("yearSelect");
  if (!sel) return;

  const currentYear = new Date().getFullYear();
  const startYear   = currentYear - 2;
  const endYear     = currentYear + 1;

  sel.innerHTML = "";
  for (let y = startYear; y <= endYear; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    if (y === currentYear) opt.selected = true;
    sel.appendChild(opt);
  }
}

document.addEventListener("DOMContentLoaded", initYearSelect);

/**
 * startRealTimeReporting(year, month)
 *
 * 1) Limpia el contenedor de reportes.
 * 2) Hace un getDocs() sobre "asistencias" y filtra por prefijo "YYYY-MM".
 * 3) Se suscribe con onSnapshot() a cada subcolección "asistencias/{fecha}/usuarios".
 * 4) Cancela listeners de fechas que ya no pertenecen al mes.
 * 5) Listener global en "asistencias" para detectar nuevas fechas del mes.
 */
export async function startRealTimeReporting(year, month) {
  const container = document.getElementById("reporte-container");
  if (!container) return;

  container.innerHTML = "";

  const yearStr = String(year || new Date().getFullYear());
  const prefijo = `${yearStr}-${month}`; // ej. "2025-06"

  try {
    const asistenciasColl = collection(db, "asistencias");

    // 2) getDocs puntual
    const snapshotAll = await getDocs(asistenciasColl);
    const fechasDisponibles = snapshotAll.docs.map((doc) => doc.id);
    const fechasDelMes = fechasDisponibles.filter((fecha) =>
      fecha.startsWith(prefijo)
    );

    if (fechasDelMes.length === 0) {
      container.innerHTML = `<p>No hay reportes para el mes seleccionado.</p>`;
      // Limpiamos listeners antiguos
      Object.values(subUnsubsUsuarios).forEach(unsub => unsub());
      subUnsubsUsuarios = {};
      if (unsubscribeAsistencias) {
        unsubscribeAsistencias();
        unsubscribeAsistencias = null;
      }
      return;
    }

    // 3) Suscribirse a cada subcolección "usuarios"
    fechasDelMes.forEach((fecha) => {
      if (!subUnsubsUsuarios[fecha]) {
        const usuariosRef = collection(db, "asistencias", fecha, "usuarios");
        const qUsuarios   = query(usuariosRef, orderBy("hora", "asc"));

        const unsubUsuarios = onSnapshot(
          qUsuarios,
          (usuariosSnap) => {
            const asistenciaData = [];
            usuariosSnap.forEach((docUser) => {
              const data = docUser.data();
              asistenciaData.push({ id: docUser.id, ...data });
            });
            renderizarTablaEnDOM(fecha, asistenciaData);
          },
          (err) => {
            console.error(
              `Error escuchando subcolección usuarios de ${fecha}: `,
              err
            );
          }
        );

        subUnsubsUsuarios[fecha] = unsubUsuarios;
      }
    });

    // 4) Cancelar listeners de fechas que ya no están en el mes
    Object.keys(subUnsubsUsuarios).forEach((fechaRegistrada) => {
      if (!fechasDelMes.includes(fechaRegistrada)) {
        subUnsubsUsuarios[fechaRegistrada]();
        delete subUnsubsUsuarios[fechaRegistrada];
        eliminarTablaDeDOM(fechaRegistrada);
      }
    });

    // 5) Listener global sobre "asistencias" para detectar nuevas fechas en el mes
    if (unsubscribeAsistencias) unsubscribeAsistencias();
    unsubscribeAsistencias = onSnapshot(
      asistenciasColl,
      (snapshotGlobal) => {
        const todasFechas = snapshotGlobal.docs.map((d) => d.id);
        const fechasNuevasDelMes = todasFechas.filter((f) =>
          f.startsWith(prefijo)
        );

        if (
          JSON.stringify([...fechasNuevasDelMes].sort()) !==
          JSON.stringify([...fechasDelMes].sort())
        ) {
          // Si cambia la lista de fechas del mes, recargamos el reporte
          startRealTimeReporting(yearStr, month);
        }
      },
      (err) => {
        console.error("Error en listener global de asistencias: ", err);
      }
    );
  } catch (err) {
    console.error("❌ Error en startRealTimeReporting:", err);
    container.innerHTML = `<p>Error al cargar los reportes. Revisa la consola.</p>`;
  }
}

// Exponer getAsistencia al global para el botón
window.getAsistencia = function () {
  const mesEl  = document.getElementById("monthSelect");
  const yearEl = document.getElementById("yearSelect");
  if (!mesEl) return;

  const mes  = mesEl.value;
  const year = yearEl ? yearEl.value : String(new Date().getFullYear());

  startRealTimeReporting(year, mes);
};
