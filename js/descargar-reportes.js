// ./js/descargar-reportes.js
import {
  collection,
  collectionGroup,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { showAlert } from "./showAlert.js";

const COLUMN_DEFS = {
  fecha: {
    header: "Fecha",
    getter: (r) => r.fecha || ""
  },
  nombre: {
    header: "Nombre",
    getter: (r) => r.nombre || ""
  },
  hora: {
    header: "Hora",
    getter: (r) => r.hora || ""
  },
  presente: {
    header: "Estado",
    getter: (r) => (r.presente ? "Presente" : "Ausente")
  },
  classType: {
    header: "Tipo de clase",
    getter: (r) => r.classType || ""
  },
  professorName: {
    header: "Profesor",
    getter: (r) => r.professorName || ""
  },
  classId: {
    header: "ID Clase",
    getter: (r) => r.classId || ""
  },
  uid: {
    header: "ID Registro",
    getter: (r) => r.uid || ""
  }
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayCRString() {
  return new Date().toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function buildMonthDates(year, month) {
  const y = Number(year);
  const m = Number(month);
  const lastDay = new Date(y, m, 0).getDate();

  return Array.from({ length: lastDay }, (_, i) => {
    return `${y}-${pad2(m)}-${pad2(i + 1)}`;
  });
}

function monthLabel(month) {
  const labels = {
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
  return labels[month] || month;
}

/**
 * Convierte cualquier documento válido de asistencia
 * a una fila uniforme para reportes/exportación.
 */
function normalizeAttendanceDoc(docSnap) {
  const data = docSnap.data() || {};
  const parts = docSnap.ref.path.split("/");

  if (parts[0] !== "asistencias") return null;

  let fecha = "";
  let classId = "";
  let classType = data.classType || "";
  let professorName = data.professorName || "";

  if (parts.length === 4 && parts[2] === "usuarios") {
    fecha = parts[1];
  } else if (parts.length === 6 && parts[2] === "clases" && parts[4] === "usuarios") {
    fecha = parts[1];
    classId = parts[3];
  } else {
    return null;
  }

  return {
    fecha,
    uid: docSnap.id,
    nombre: data.nombre || "",
    hora: data.hora || "",
    presente: !!data.presente,
    classType,
    professorName,
    classId
  };
}

/**
 * Lee asistencias solo del mes seleccionado.
 */
async function fetchAttendanceDataForMonth(year, month) {
  const fechas = buildMonthDates(year, month);
  const rows = [];

  for (const fecha of fechas) {
    const usuariosRef = collection(db, "asistencias", fecha, "usuarios");
    const usuariosSnap = await getDocs(usuariosRef);

    usuariosSnap.forEach((docSnap) => {
      const row = normalizeAttendanceDoc(docSnap);
      if (row) rows.push(row);
    });
  }

  return rows.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.hora !== b.hora) return String(a.hora).localeCompare(String(b.hora));
    return String(a.nombre).localeCompare(String(b.nombre));
  });
}

/**
 * Lee todo el histórico real desde subcolecciones "usuarios".
 */
async function fetchAttendanceDataForAllHistory() {
  const snap = await getDocs(collectionGroup(db, "usuarios"));
  const rows = [];

  snap.forEach((docSnap) => {
    const row = normalizeAttendanceDoc(docSnap);
    if (row) rows.push(row);
  });

  return rows.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.hora !== b.hora) return String(a.hora).localeCompare(String(b.hora));
    return String(a.nombre).localeCompare(String(b.nombre));
  });
}

async function fetchAttendanceData(scope, year, month) {
  if (scope === "all") {
    return fetchAttendanceDataForAllHistory();
  }
  return fetchAttendanceDataForMonth(year, month);
}

/**
 * Resumen por alumno.
 */
function buildSummaryRows(rows) {
  const byName = {};

  rows.forEach((row) => {
    const name = row.nombre || "(Sin nombre)";

    if (!byName[name]) {
      byName[name] = {
        nombre: name,
        total: 0,
        presentes: 0,
        ausentes: 0
      };
    }

    byName[name].total += 1;
    if (row.presente) byName[name].presentes += 1;
    else byName[name].ausentes += 1;
  });

  return Object.values(byName)
    .map((item) => ({
      nombre: item.nombre,
      total: item.total,
      presentes: item.presentes,
      ausentes: item.ausentes,
      porcentaje:
        item.total > 0
          ? `${((item.presentes / item.total) * 100).toFixed(1)}%`
          : "0.0%"
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function countDistinctDays(rows) {
  return new Set(rows.map((r) => r.fecha).filter(Boolean)).size;
}

function buildMetaRows(rows, scope, year, month) {
  const total = rows.length;
  const presentes = rows.filter((r) => r.presente).length;
  const ausentes = total - presentes;
  const dias = countDistinctDays(rows);

  return [
    ["REPORTE DE ASISTENCIA"],
    [],
    ["Período", scope === "month" ? `${monthLabel(month)} ${year}` : "Histórico completo"],
    ["Alcance", scope === "month" ? "Mes seleccionado" : "Todo el histórico"],
    ["Generado", todayCRString()],
    ["Días con asistencia", dias],
    ["Registros totales", total],
    ["Presentes", presentes],
    ["Ausentes", ausentes]
  ];
}

function buildDetailTable(rows, selectedCols) {
  let cols = selectedCols.filter((c) => COLUMN_DEFS[c]);

  if (!cols.length) {
    cols = ["fecha", "nombre", "hora", "presente"];
  }

  const headers = cols.map((c) => COLUMN_DEFS[c].header);
  const body = rows.map((row) => cols.map((c) => COLUMN_DEFS[c].getter(row)));

  return { cols, headers, body };
}

function buildSummaryTable(rows) {
  const summaryRows = buildSummaryRows(rows);
  const headers = ["Nombre", "Total clases", "Presentes", "Ausentes", "% asistencia"];
  const body = summaryRows.map((row) => [
    row.nombre,
    row.total,
    row.presentes,
    row.ausentes,
    row.porcentaje
  ]);

  return { headers, body, summaryRows };
}

function autoColumnWidths(matrix) {
  if (!matrix.length) return [];

  const colCount = Math.max(...matrix.map((row) => row.length));

  return Array.from({ length: colCount }, (_, colIdx) => {
    let maxLen = 10;

    for (const row of matrix) {
      const cell = row[colIdx] ?? "";
      const len = String(cell).length;
      if (len > maxLen) maxLen = len;
    }

    return { wch: Math.min(maxLen + 2, 32) };
  });
}

function applyAutoFilter(ws, startRow, headers) {
  if (!headers?.length) return;
  const endCol = XLSX.utils.encode_col(headers.length - 1);
  const start = startRow + 1;
  ws["!autofilter"] = {
    ref: `A${start}:${endCol}${start}`
  };
}

function setSheetCols(ws, matrix) {
  ws["!cols"] = autoColumnWidths(matrix);
}

function setSheetMerges(ws, merges) {
  ws["!merges"] = merges || [];
}

function makeMetaSheet(rows, scope, year, month) {
  const metaRows = buildMetaRows(rows, scope, year, month);
  const ws = XLSX.utils.aoa_to_sheet(metaRows);

  setSheetCols(ws, metaRows);
  setSheetMerges(ws, [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
  ]);

  return ws;
}

function makeDetailSheet(rows, selectedCols, scope, year, month) {
  const metaRows = buildMetaRows(rows, scope, year, month);
  const detail = buildDetailTable(rows, selectedCols);

  const matrix = [
    ...metaRows,
    [],
    detail.headers,
    ...detail.body
  ];

  const ws = XLSX.utils.aoa_to_sheet(matrix);

  setSheetCols(ws, matrix);
  setSheetMerges(ws, [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(detail.headers.length - 1, 1) } }
  ]);

  applyAutoFilter(ws, metaRows.length + 1, detail.headers);

  return ws;
}

function makeSummarySheet(rows, scope, year, month) {
  const metaRows = buildMetaRows(rows, scope, year, month);
  const summary = buildSummaryTable(rows);

  const matrix = [
    ...metaRows,
    [],
    summary.headers,
    ...summary.body
  ];

  const ws = XLSX.utils.aoa_to_sheet(matrix);

  setSheetCols(ws, matrix);
  setSheetMerges(ws, [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(summary.headers.length - 1, 1) } }
  ]);

  applyAutoFilter(ws, metaRows.length + 1, summary.headers);

  return ws;
}

function makeConfigSheet(scope, mode, selectedCols, year, month) {
  const rows = [
    ["CONFIGURACIÓN DEL REPORTE"],
    [],
    ["Año", year],
    ["Mes", month],
    ["Alcance", scope === "month" ? "Mes seleccionado" : "Todo el histórico"],
    ["Tipo principal solicitado", mode === "summary" ? "Resumen" : "Detalle"],
    ["Columnas detalladas", selectedCols.length ? selectedCols.join(", ") : "Por defecto"]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setSheetCols(ws, rows);
  setSheetMerges(ws, [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
  ]);

  return ws;
}

function renderPreviewTable(rows, selectedCols, mode, meta) {
  const container = document.getElementById("excel-preview");
  const section = document.getElementById("excel-preview-card");
  if (!container || !section) return;

  section.classList.remove("hidden");
  container.innerHTML = "";

  const MAX_ROWS = 50;

  const info = document.createElement("p");
  info.className = "report-preview-note";
  info.textContent =
    meta.scope === "month"
      ? `Vista previa · ${monthLabel(meta.month)} ${meta.year}`
      : "Vista previa · histórico completo";
  container.appendChild(info);

  let headers = [];
  let body = [];

  if (mode === "summary") {
    const summary = buildSummaryTable(rows);
    headers = summary.headers;
    body = summary.body;
  } else {
    const detail = buildDetailTable(rows, selectedCols);
    headers = detail.headers;
    body = detail.body;
  }

  const table = document.createElement("table");
  table.className = "asistencia-table";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const tbody = document.createElement("tbody");
  body.slice(0, MAX_ROWS).forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);

  const note = document.createElement("p");
  note.className = "report-preview-note";
  note.textContent =
    body.length > MAX_ROWS
      ? `Mostrando ${MAX_ROWS} filas de ${body.length}. El Excel descargado incluirá todos los registros.`
      : `Total de filas: ${body.length}.`;
  container.appendChild(note);
}

function buildProfessionalWorkbook(rows, selectedCols, scope, mode, year, month) {
  const wb = XLSX.utils.book_new();

  const wsMeta = makeMetaSheet(rows, scope, year, month);
  const wsSummary = makeSummarySheet(rows, scope, year, month);
  const wsDetail = makeDetailSheet(rows, selectedCols, scope, year, month);
  const wsConfig = makeConfigSheet(scope, mode, selectedCols, year, month);

  if (mode === "summary") {
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle");
  } else {
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
  }

  XLSX.utils.book_append_sheet(wb, wsMeta, "Información");
  XLSX.utils.book_append_sheet(wb, wsConfig, "Configuración");

  return wb;
}

function buildFileName(scope, mode, year, month) {
  const suffix = scope === "month" ? `${year}-${month}` : "historico";
  const modeLabel = mode === "summary" ? "resumen" : "detalle";
  return `bocaraca_reporte_asistencia_${modeLabel}_${suffix}.xlsx`;
}

async function descargarReporteAsistencia(arg) {
  const previewOnly = !!(arg && typeof arg === "object" && arg.preview);
  const boton = document.getElementById("btnDescargar");
  if (boton) boton.disabled = true;

  try {
    if (typeof XLSX === "undefined") {
      showAlert("La librería XLSX no está cargada.", "error");
      return;
    }

    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");

    const year = yearSelect ? yearSelect.value : String(new Date().getFullYear());
    const month = monthSelect ? monthSelect.value : "01";

    const scopeInput = document.querySelector('input[name="reportScope"]:checked');
    const modeInput = document.querySelector('input[name="reportMode"]:checked');

    const scope = scopeInput ? scopeInput.value : "month";
    const mode = modeInput ? modeInput.value : "detail";

    const selectedCols = Array.from(
      document.querySelectorAll(".report-col-checkbox:checked")
    ).map((cb) => cb.value);

    const rows = await fetchAttendanceData(scope, year, month);

    if (!rows.length) {
      showAlert("No hay registros de asistencia para el rango seleccionado.", "error");
      return;
    }

    renderPreviewTable(rows, selectedCols, mode, { scope, year, month });

    if (previewOnly) {
      showAlert("Vista previa generada.", "success");
      return;
    }

    const wb = buildProfessionalWorkbook(
      rows,
      selectedCols,
      scope,
      mode,
      year,
      month
    );

    const fileName = buildFileName(scope, mode, year, month);
    XLSX.writeFile(wb, fileName);

    showAlert("Reporte descargado exitosamente.", "success");
  } catch (error) {
    console.error("Error al generar el reporte:", error);
    showAlert("Hubo un error al generar el reporte.", "error");
  } finally {
    if (boton) boton.disabled = false;
  }
}

window.descargarReporteAsistencia = descargarReporteAsistencia;

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnDescargar");
  if (btn && !btn.dataset.bound) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      descargarReporteAsistencia();
    });
    btn.dataset.bound = "1";
  }
});