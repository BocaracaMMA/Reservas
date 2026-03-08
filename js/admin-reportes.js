// ./js/admin-reportes.js
import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const monthNames = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre"
};

let dayListeners = [];
let attendanceByDate = {};

/**
 * Llena el select de años.
 */
function initYearSelect() {
  const sel = document.getElementById("yearSelect");
  if (!sel) return;

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2;
  const endYear = currentYear + 1;

  sel.innerHTML = "";

  for (let y = startYear; y <= endYear; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    if (y === currentYear) opt.selected = true;
    sel.appendChild(opt);
  }
}

/**
 * Selecciona por defecto el mes actual.
 */
function initCurrentMonth() {
  const monthSelect = document.getElementById("monthSelect");
  if (!monthSelect) return;

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  monthSelect.value = currentMonth;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Retorna todas las fechas YYYY-MM-DD del mes.
 */
function buildMonthDates(year, month) {
  const y = Number(year);
  const m = Number(month);
  const lastDay = new Date(y, m, 0).getDate();

  return Array.from({ length: lastDay }, (_, i) => {
    return `${y}-${pad2(m)}-${pad2(i + 1)}`;
  });
}

/**
 * Formatea la fecha para mostrarla más limpia.
 */
function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);

  return dt.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

/**
 * Limpia listeners activos del reporte.
 */
function cleanupDayListeners() {
  dayListeners.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });

  dayListeners = [];
}

/**
 * Reinicia tarjetas de métricas.
 */
function resetStats() {
  const ids = {
    statDays: "0",
    statTotal: "0",
    statPresent: "0",
    statAbsent: "0"
  };

  Object.entries(ids).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

/**
 * Actualiza el resumen superior.
 */
function renderStats(dateMap) {
  const dates = Object.keys(dateMap).filter((date) => (dateMap[date] || []).length > 0);
  const rows = dates.flatMap((date) => dateMap[date]);

  const total = rows.length;
  const present = rows.filter((r) => !!r.presente).length;
  const absent = total - present;

  const statDays = document.getElementById("statDays");
  const statTotal = document.getElementById("statTotal");
  const statPresent = document.getElementById("statPresent");
  const statAbsent = document.getElementById("statAbsent");

  if (statDays) statDays.textContent = String(dates.length);
  if (statTotal) statTotal.textContent = String(total);
  if (statPresent) statPresent.textContent = String(present);
  if (statAbsent) statAbsent.textContent = String(absent);
}

/**
 * Genera una tarjeta visual por día.
 */
function generateDayCard(date, rows) {
  const total = rows.length;
  const present = rows.filter((u) => !!u.presente).length;
  const absent = total - present;

  return `
    <article class="report-day-card modern">
      <header class="report-day-header modern">
        <div class="report-day-title-block">
          <div class="report-day-title">
            <i class="bi bi-calendar-event"></i>
            <span>${formatDateLabel(date)}</span>
          </div>
          <small class="report-day-code">${date}</small>
        </div>

        <div class="report-day-badges">
          <span class="report-badge report-badge-blue">${total} registros</span>
          <span class="report-badge report-badge-green">${present} presentes</span>
          <span class="report-badge report-badge-red">${absent} ausentes</span>
        </div>
      </header>

      <div class="report-day-body">
        <div class="table-container report-table-wrap">
          <table class="asistencia-table report-table-modern">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Hora</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((user) => `
                <tr>
                  <td>${user.nombre || ""}</td>
                  <td>${user.hora || ""}</td>
                  <td>
                    <span class="report-status-pill ${user.presente ? "ok" : "bad"}">
                      ${user.presente ? "Presente" : "Ausente"}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  `;
}

/**
 * Estado vacío del reporte.
 */
function generateEmptyState(year, month) {
  const monthLabel = monthNames[month] || month;

  return `
    <div class="report-empty-state">
      <div class="report-empty-icon">
        <i class="bi bi-inbox"></i>
      </div>
      <h3>Sin registros para ${monthLabel} ${year}</h3>
      <p>
        No se encontraron asistencias en el período seleccionado.
      </p>
    </div>
  `;
}

/**
 * Render completo del reporte.
 */
function renderReport(year, month) {
  const container = document.getElementById("reporte-container");
  if (!container) return;

  const dates = Object.keys(attendanceByDate)
    .filter((date) => (attendanceByDate[date] || []).length > 0)
    .sort((a, b) => b.localeCompare(a));

  renderStats(attendanceByDate);

  if (!dates.length) {
    container.innerHTML = generateEmptyState(year, month);
    return;
  }

  container.innerHTML = dates
    .map((date) => generateDayCard(date, attendanceByDate[date]))
    .join("");
}

/**
 * Suscribe cada día del mes directamente a /asistencias/{fecha}/usuarios.
 * Esto evita depender de que exista el documento padre /asistencias/{fecha}.
 */
export function startRealTimeReporting(year, month) {
  cleanupDayListeners();
  attendanceByDate = {};
  resetStats();

  const container = document.getElementById("reporte-container");
  if (container) {
    container.innerHTML = `
      <div class="report-loading-state">
        <span class="dot"></span>
        <span>Cargando reporte...</span>
      </div>
    `;
  }

  const dates = buildMonthDates(year, month);

  dates.forEach((date) => {
    const usuariosRef = collection(db, "asistencias", date, "usuarios");
    const qUsuarios = query(usuariosRef, orderBy("hora", "asc"));

    const unsub = onSnapshot(
      qUsuarios,
      (snap) => {
        const rows = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          rows.push({
            id: docSnap.id,
            nombre: data.nombre || "",
            hora: data.hora || "",
            presente: !!data.presente
          });
        });

        attendanceByDate[date] = rows;
        renderReport(year, month);
      },
      (error) => {
        console.error(`Error escuchando asistencias de ${date}:`, error);
      }
    );

    dayListeners.push(unsub);
  });
}

/**
 * Expone la acción del botón Ver reporte.
 */
window.getAsistencia = function () {
  const mesEl = document.getElementById("monthSelect");
  const yearEl = document.getElementById("yearSelect");

  if (!mesEl || !yearEl) return;

  startRealTimeReporting(yearEl.value, mesEl.value);
};

document.addEventListener("DOMContentLoaded", () => {
  initYearSelect();
  initCurrentMonth();

  const yearEl = document.getElementById("yearSelect");
  const monthEl = document.getElementById("monthSelect");

  if (yearEl && monthEl) {
    startRealTimeReporting(yearEl.value, monthEl.value);
  }
});

window.addEventListener("beforeunload", cleanupDayListeners);