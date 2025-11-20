// ./js/descargar-reportes.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { showAlert } from "./showAlert.js";

// Definición de columnas disponibles para el Excel detallado
const COLUMN_DEFS = {
  fecha: {
    header: "Fecha",
    getter: (r) => r.fecha,
  },
  nombre: {
    header: "Nombre",
    getter: (r) => r.nombre,
  },
  hora: {
    header: "Hora",
    getter: (r) => r.hora,
  },
  presente: {
    header: "Presente",
    getter: (r) => (r.presente ? "Sí" : "No"),
  },
  classType: {
    header: "Tipo de clase",
    getter: (r) => r.classType,
  },
  professorName: {
    header: "Profesor",
    getter: (r) => r.professorName,
  },
  classId: {
    header: "ID Clase",
    getter: (r) => r.classId,
  },
  uid: {
    header: "ID Asistencia",
    getter: (r) => r.uid,
  },
};

/**
 * Lee toda la asistencia desde Firestore según el alcance:
 *  - scope: "month" => solo el mes seleccionado
 *  - scope: "all"   => todo el histórico
 */
async function fetchAttendanceData(scope, year, month) {
  const asistenciaRef = collection(db, "asistencias");
  const snapshot = await getDocs(asistenciaRef);

  if (snapshot.empty) return [];

  const prefix = `${year}-${month}`;

  // Filtrar fechas según alcance
  const fechas = snapshot.docs
    .map((d) => d.id)
    .filter((id) => (scope === "month" ? id.startsWith(prefix) : true))
    .sort();

  if (!fechas.length) return [];

  const allRows = [];

  for (const fecha of fechas) {
    const usuariosRef = collection(db, "asistencias", fecha, "usuarios");
    const usuariosSnap = await getDocs(usuariosRef);

    usuariosSnap.forEach((userDoc) => {
      const data = userDoc.data() || {};
      allRows.push({
        fecha,
        uid: userDoc.id,
        nombre: data.nombre || "",
        hora: data.hora || "",
        presente: !!data.presente,
        classType: data.classType || "",
        professorName: data.professorName || "",
        classId: data.classId || "",
      });
    });
  }

  return allRows;
}

/* ─────────────────── Helpers para matrices (detalle / resumen) ─────────────────── */

function buildDetailMatrix(rows, selectedCols) {
  let cols = selectedCols.filter((c) => COLUMN_DEFS[c]);

  // Fallback por si el usuario desmarca todo
  if (!cols.length) {
    cols = ["fecha", "nombre", "hora", "presente"];
  }

  const headers = cols.map((c) => COLUMN_DEFS[c].header);
  const matrix = [headers];

  rows.forEach((row) => {
    matrix.push(cols.map((c) => COLUMN_DEFS[c].getter(row) ?? ""));
  });

  return { cols, matrix };
}

// Construye hoja detallada
function buildDetailSheet(rows, selectedCols) {
  const { matrix } = buildDetailMatrix(rows, selectedCols);
  return XLSX.utils.aoa_to_sheet(matrix);
}

function buildSummaryMatrix(rows) {
  const byName = {};

  rows.forEach((r) => {
    const name = r.nombre || "(Sin nombre)";
    if (!byName[name]) {
      byName[name] = { total: 0, presentes: 0, ausentes: 0 };
    }
    byName[name].total++;
    if (r.presente) byName[name].presentes++;
    else byName[name].ausentes++;
  });

  const matrix = [
    ["Nombre", "Total clases", "Presentes", "Ausentes", "% asistencia"],
  ];

  Object.entries(byName)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, stats]) => {
      const pct =
        stats.total > 0 ? (stats.presentes / stats.total) * 100 : 0;
      matrix.push([
        name,
        stats.total,
        stats.presentes,
        stats.ausentes,
        `${pct.toFixed(1)}%`,
      ]);
    });

  return matrix;
}

// Construye hoja resumen por alumno
function buildSummarySheet(rows) {
  const matrix = buildSummaryMatrix(rows);
  return XLSX.utils.aoa_to_sheet(matrix);
}

/* ─────────────────── Vista previa HTML ─────────────────── */

function renderPreviewTable(rows, selectedCols, mode, meta) {
  const container = document.getElementById("excel-preview");
  if (!container) return;

  // Mostrar la card de vista previa (estaba con class="hidden")
  const section = document.getElementById("excel-preview-card");
  if (section) {
    section.classList.remove("hidden");
  }

  container.innerHTML = "";

  const MAX_ROWS = 50;
  let matrix;

  if (mode === "summary") {
    matrix = buildSummaryMatrix(rows);
  } else {
    const m = buildDetailMatrix(rows, selectedCols);
    matrix = m.matrix;
  }

  const [headers, ...dataRows] = matrix;

  // Texto arriba de la tabla
  const info = document.createElement("p");
  info.className = "report-preview-note";
  const scopeLabel =
    meta && meta.scope === "month"
      ? `mes ${meta.year}-${meta.month}`
      : "todo el histórico";
  info.textContent = `Vista previa (${mode === "summary" ? "resumen por alumno" : "detalle"}) · ${scopeLabel}.`;
  container.appendChild(info);

  // Tabla
  const table = document.createElement("table");
  table.className = "asistencia-table"; // reutiliza el estilo de las otras tablas

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const tbody = document.createElement("tbody");

  dataRows.slice(0, MAX_ROWS).forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);

  if (dataRows.length > MAX_ROWS) {
    const note = document.createElement("p");
    note.className = "report-preview-note";
    note.textContent = `Mostrando ${MAX_ROWS} filas de ${dataRows.length}. El Excel incluirá todos los registros.`;
    container.appendChild(note);
  }

  // Scroll suave hasta la vista previa
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ─────────────────── Generar Excel + Vista previa ─────────────────── */

async function descargarReporteAsistencia(arg) {
  // Si se llama como descargarReporteAsistencia({ preview: true }) mostramos solo vista previa.
  const previewOnly = !!(arg && typeof arg === "object" && arg.preview);

  const boton = document.getElementById("btnDescargar");
  if (boton) boton.disabled = true;

  try {
    if (typeof XLSX === "undefined") {
      showAlert("La librería XLSX no está cargada", "error");
      return;
    }

    const yearSelect  = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");

    const year  = yearSelect ? yearSelect.value : String(new Date().getFullYear());
    const month = monthSelect ? monthSelect.value : "01";

    const scopeInput = document.querySelector('input[name="reportScope"]:checked');
    const modeInput  = document.querySelector('input[name="reportMode"]:checked');

    const scope = scopeInput ? scopeInput.value : "month";   // "month" | "all"
    const mode  = modeInput ? modeInput.value : "detail";    // "detail" | "summary"

    const selectedCols = Array.from(
      document.querySelectorAll(".report-col-checkbox:checked")
    ).map((cb) => cb.value);

    const rows = await fetchAttendanceData(scope, year, month);

    if (!rows.length) {
      showAlert(
        "No hay registros de asistencia para el rango seleccionado.",
        "error"
      );
      return;
    }

    // Siempre generamos vista previa
    renderPreviewTable(rows, selectedCols, mode, { scope, year, month });

    // Si solo queremos vista previa, no descargamos archivo
    if (previewOnly) {
      showAlert(
        "Vista previa generada. Si todo se ve bien, pulsa “Descargar Excel”.",
        "success"
      );
      return;
    }

    // Modo descarga real
    const wb = XLSX.utils.book_new();

    if (mode === "summary") {
      const wsSummary = buildSummarySheet(rows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    } else {
      const wsDetail = buildDetailSheet(rows, selectedCols);
      XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle");
    }

    const suffix =
      scope === "month" ? `${year}-${month}` : "historico";

    const fileName =
      mode === "summary"
        ? `reporte_asistencia_resumen_${suffix}.xlsx`
        : `reporte_asistencia_detalle_${suffix}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showAlert("Reporte descargado exitosamente", "success");
  } catch (error) {
    console.error("Error al generar el reporte:", error);
    showAlert("Hubo un error al generar el reporte", "error");
  } finally {
    if (boton) boton.disabled = false;
  }
}

// Exponer global
window.descargarReporteAsistencia = descargarReporteAsistencia;

// Enganchar botones
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnDescargar");
  if (btn && !btn.dataset.bound) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      descargarReporteAsistencia(); // vista previa + descarga
    });
    btn.dataset.bound = "1";
  }

  // Si algún día quieres un botón de solo vista previa:
  // <button id="btnPreviewExcel">Ver vista previa</button>
  const btnPrev = document.getElementById("btnPreviewExcel");
  if (btnPrev && !btnPrev.dataset.bound) {
    btnPrev.addEventListener("click", (e) => {
      e.preventDefault();
      descargarReporteAsistencia({ preview: true }); // solo vista previa
    });
    btnPrev.dataset.bound = "1";
  }
});
