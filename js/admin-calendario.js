// ./js/admin-calendario.js
// Configuración del calendario semanal de clases (solo administración).
// - Define bloques recurrentes (día, hora, profesor, cupos).
// - Marca visualmente como deshabilitados los días sin NINGUNA clase activa.
// - Usa una "colorKey" para decidir el color del evento en el calendario.
// - Permite elegir una key predefinida (dropdown) o una personalizada.

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from "./showAlert.js";

/* -----------------------------------------------------------------------------
   Color keys y paleta de colores
----------------------------------------------------------------------------- */

// Claves predefinidas visibles en el dropdown
const PRESET_COLOR_KEYS = ["MMA - GENERAL", "SPARRING", "PRIVADA"];

// Colores fijos para las predefinidas
const COLOR_MAP = {
  "MMA - GENERAL": "#3b82f6", // azul
  SPARRING: "#f97316",        // naranja
  PRIVADA: "#22c55e",         // verde
};

// Paleta de respaldo para keys personalizadas
const FALLBACK_COLORS = [
  "#ec4899", // rosa
  "#8b5cf6", // violeta
  "#eab308", // amarillo
  "#06b6d4", // turquesa
  "#f97316", // naranja
  "#10b981", // verde
];

/**
 * Devuelve un color "bonito" y estable para cada key.
 * - Predefinidas usan COLOR_MAP.
 * - Keys personalizadas usan un hash sobre FALLBACK_COLORS.
 */
function getColorForKey(rawKey) {
  const key = (rawKey || "").trim();
  if (!key) return "#3b6cff";

  if (COLOR_MAP[key]) return COLOR_MAP[key];

  // Hash simple para elegir siempre el mismo color para una key dada
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  const idx = hash % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[idx];
}

/**
 * Resuelve la colorKey efectiva combinando dropdown + campo personalizado.
 * - Si el select es "_custom" y hay texto en el input, se usa ese texto.
 * - En cualquier otro caso, se usa el valor del select.
 */
function resolveColorKey(selectId, customId) {
  const sel = document.getElementById(selectId);
  const custom = document.getElementById(customId);

  if (!sel) return "";

  if (sel.value === "_custom" && custom && custom.value.trim()) {
    return custom.value.trim();
  }
  return sel.value || "";
}

/**
 * Configura el comportamiento de los dropdowns de color:
 * - Muestran/ocultan el campo de texto personalizado cuando se elige "_custom".
 */
function setupColorKeyDropdowns() {
  wireColorDropdown("createColorKey", "createColorKeyCustom");
  wireColorDropdown("editColorKey", "editColorKeyCustom");
}

function wireColorDropdown(selectId, customId) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  if (!select || !custom) return;

  const toggle = () => {
    if (select.value === "_custom") {
      custom.classList.remove("hidden");
      custom.focus();
    } else {
      custom.classList.add("hidden");
    }
  };

  // Estado inicial
  toggle();
  // Cambio de valor
  select.addEventListener("change", toggle);
}

/* -----------------------------------------------------------------------------
   Arranque del módulo
----------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  setupColorKeyDropdowns();

  initAdminScheduleCalendar().catch((err) => {
    console.error("[admin-calendario] Error inicializando calendario:", err);
    showAlert("No se pudo cargar el calendario de configuración.", "error");
  });
});

/* -----------------------------------------------------------------------------
   Carga de datos desde Firestore
----------------------------------------------------------------------------- */

/**
 * Lee todos los bloques de clase desde la colección classSchedule.
 * Cada documento representa un bloque recurrente semanal.
 */
async function loadClassSchedule() {
  const ref = collection(db, "classSchedule");
  const snap = await getDocs(ref);

  const blocks = [];
  snap.forEach((docSnap) => {
    blocks.push({ id: docSnap.id, ...docSnap.data() });
  });

  return blocks;
}

/**
 * Obtiene la lista de profesores (users con rol "professor").
 */
async function loadProfessors() {
  const ref = collection(db, "users");
  const snap = await getDocs(ref);

  const result = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (Array.isArray(d.roles) && d.roles.includes("professor")) {
      const nombre = (d.nombre || "").trim();
      const apellidos = (d.apellidos || "").trim();
      result.push({
        uid: d.uid,
        name: `${nombre} ${apellidos}`.trim(),
      });
    }
  });

  return result;
}

/**
 * Rellena los selects de profesor en los modales de crear/editar.
 */
function fillProfessorSelects(list) {
  const createSelect = document.getElementById("createProfessor");
  const editSelect = document.getElementById("editProfessor");

  if (!createSelect || !editSelect) return;

  list.forEach((p) => {
    const opt1 = document.createElement("option");
    opt1.value = p.uid;
    opt1.textContent = p.name;
    createSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = p.uid;
    opt2.textContent = p.name;
    editSelect.appendChild(opt2);
  });
}

/* -----------------------------------------------------------------------------
   Construcción de eventos para FullCalendar
----------------------------------------------------------------------------- */

/**
 * Construye los eventos recurrentes a partir de los bloques de Firestore.
 * Usa colorKey para decidir el color del evento.
 */
function buildEvents(blocks) {
  return blocks
    .filter((b) => b.active !== false) // si no existe, se considera activo
    .map((b) => {
      const isPermanent =
        typeof b.permanent === "boolean" ? b.permanent : true;

      // Si no hubiera colorKey guardado, usamos el tipo como base
      const rawKey = b.colorKey || b.type || "MMA - GENERAL";
      const color = getColorForKey(rawKey);

      return {
        id: b.id,
        title: `${b.type} - ${b.professorName || "Sin profesor"}`,
        startRecur: "2025-01-01",
        endRecur: "2030-01-01",
        daysOfWeek: [Number(b.dayOfWeek ?? 0)],
        startTime: b.startTime,
        endTime: b.endTime,
        color,
        extendedProps: {
          minCapacity: b.minCapacity ?? null,
          maxCapacity: b.maxCapacity ?? null,
          colorKey: rawKey,
          professorId: b.professorId ?? "",
          permanent: isPermanent,
        },
      };
    });
}

/**
 * Devuelve un conjunto con los días (0–6) que tienen al menos
 * UNA clase activa (permanente o no).
 * Se usa para marcar visualmente los días bloqueados en el calendario.
 */
function getActiveDays(blocks) {
  const set = new Set();
  blocks.forEach((b) => {
    const isActive = b.active !== false;
    if (!isActive) return;

    const dow = Number(b.dayOfWeek ?? NaN);
    if (!Number.isNaN(dow)) set.add(dow);
  });
  return set;
}

/* -----------------------------------------------------------------------------
   Inicialización del calendario de configuración (FullCalendar)
----------------------------------------------------------------------------- */

async function initAdminScheduleCalendar() {
  const calendarEl = document.getElementById("calendarAdmin");
  if (!calendarEl) {
    console.warn("[admin-calendario] No se encontró #calendarAdmin en el DOM.");
    return;
  }

  if (!window.FullCalendar) {
    console.error("[admin-calendario] FullCalendar no está disponible.");
    return;
  }

  // Cargar datos base
  const [classBlocks, professors] = await Promise.all([
    loadClassSchedule(),
    loadProfessors(),
  ]);

  fillProfessorSelects(professors);
  const activeDays = getActiveDays(classBlocks);

  // Altura mínima para que no quede mucho hueco en móvil
  if (!calendarEl.style.minHeight) {
    calendarEl.style.minHeight = "560px";
  }

  const calendar = new window.FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    locale: "es",
    firstDay: 1,
    selectable: true,
    editable: false,
    allDaySlot: false,
    slotMinTime: "06:00:00",
    slotMaxTime: "22:30:00",
    expandRows: true,
    height: "auto",

    // NUEVO / AJUSTADO
    nowIndicator: true,
    slotLabelFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    },
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    },
    dayHeaderFormat: {
      weekday: 'short',
      day: '2-digit'
    },

  // Eventos desde Firestore
      events: buildEvents(classBlocks),

      // Marca días sin clases como deshabilitados
      dayCellClassNames(arg) {
        const dow = arg.date.getDay(); // 0 = dom, 6 = sáb
        return activeDays.has(dow) ? [] : ["disabled-day"];
      },

      // Crear clase al hacer click en una celda
      dateClick(info) {
        openCreateModal(info, professors);
      },

      // Editar clase al hacer click en un evento
      eventClick(info) {
        openEditModal(info, professors, classBlocks);
      },
    });

  calendar.render();
}

/* -----------------------------------------------------------------------------
   Modales: creación de bloque
----------------------------------------------------------------------------- */

function openCreateModal(info, professors) {
  const modal = document.getElementById("modalCreateClass");
  if (!modal) return;

  modal.classList.remove("hidden");

  const btnCancel = document.getElementById("btnCreateCancel");
  const btnSave = document.getElementById("btnCreateSave");

  if (btnCancel) {
    btnCancel.onclick = () => {
      modal.classList.add("hidden");
    };
  }

  if (btnSave) {
    btnSave.onclick = async () => {
      const type =
        document.getElementById("createType")?.value.trim() ?? "";
      const startTime =
        document.getElementById("createStartTime")?.value ?? "";
      const endTime =
        document.getElementById("createEndTime")?.value ?? "";
      const minCap = Number(
        document.getElementById("createMinCap")?.value || 0
      );
      const maxCap = Number(
        document.getElementById("createMaxCap")?.value || 0
      );

      const colorKey = resolveColorKey(
        "createColorKey",
        "createColorKeyCustom"
      );

      const profId =
        document.getElementById("createProfessor")?.value ?? "";
      const permanent = document.getElementById("createPermanent")
        ? document.getElementById("createPermanent").checked
        : true; // por defecto, todo nuevo horario se considera permanente

      const prof = professors.find((p) => p.uid === profId);

      if (!type || !startTime || !endTime || !prof) {
        showAlert("Completa tipo, horario y profesor.", "error");
        return;
      }

      try {
        await addDoc(collection(db, "classSchedule"), {
          dayOfWeek: info.date.getUTCDay(), // 0=domingo, 6=sábado
          startTime,
          endTime,
          type,
          minCapacity: minCap || null,
          maxCapacity: maxCap || null,
          colorKey,
          professorId: prof.uid,
          professorName: prof.name,
          active: true,
          permanent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        modal.classList.add("hidden");
        showAlert("Horario creado correctamente.", "success");
        // Recargar para refrescar días deshabilitados y eventos
        location.reload();
      } catch (err) {
        console.error("[admin-calendario] Error al crear horario:", err);
        showAlert("No se pudo guardar el horario.", "error");
      }
    };
  }
}

/* -----------------------------------------------------------------------------
   Modales: edición / eliminación de bloque
----------------------------------------------------------------------------- */

function openEditModal(info, professors, classBlocks) {
  const modal = document.getElementById("modalEditClass");
  if (!modal) return;

  modal.classList.remove("hidden");

  const id = info.event.id;
  document.getElementById("editId").value = id;

  // Buscar el bloque completo para recuperar permanent, min/max, colorKey, etc.
  const block = classBlocks.find((b) => b.id === id) || {};

  const [typeFromTitle, professorNameFromTitle] =
    (info.event.title || "").split(" - ");

  // Referencias a campos
  const typeInput = document.getElementById("editType");
  const startInput = document.getElementById("editStartTime");
  const endInput = document.getElementById("editEndTime");
  const minCapInput = document.getElementById("editMinCap");
  const maxCapInput = document.getElementById("editMaxCap");
  const profSelect = document.getElementById("editProfessor");
  const permanentCheck = document.getElementById("editPermanent");

  const colorSelect = document.getElementById("editColorKey");
  const colorCustom = document.getElementById("editColorKeyCustom");

  if (typeInput) {
    typeInput.value = block.type || typeFromTitle || "";
  }

  if (startInput) {
    if (block.startTime) {
      startInput.value = block.startTime;
    } else if (info.event.startStr) {
      startInput.value = info.event.startStr.split("T")[1].substring(0, 5);
    }
  }

  if (endInput) {
    if (block.endTime) {
      endInput.value = block.endTime;
    } else if (info.event.endStr) {
      endInput.value = info.event.endStr.split("T")[1].substring(0, 5);
    } else {
      endInput.value = "";
    }
  }

  if (minCapInput) {
    minCapInput.value = block.minCapacity ?? "";
  }
  if (maxCapInput) {
    maxCapInput.value = block.maxCapacity ?? "";
  }

  // Asignación inicial del colorKey en el dropdown/campo personalizado
  const rawKey = (block.colorKey || "").trim();

  if (colorSelect && colorCustom) {
    if (!rawKey) {
      colorSelect.value = "MMA - GENERAL";
      colorCustom.classList.add("hidden");
      colorCustom.value = "";
    } else if (PRESET_COLOR_KEYS.includes(rawKey)) {
      colorSelect.value = rawKey;
      colorCustom.classList.add("hidden");
      colorCustom.value = "";
    } else {
      colorSelect.value = "_custom";
      colorCustom.classList.remove("hidden");
      colorCustom.value = rawKey;
    }
  }

  const profFromBlock = professors.find((p) => p.uid === block.professorId);
  const profFromTitle = professors.find(
    (p) => p.name === professorNameFromTitle
  );
  const selectedProf = profFromBlock || profFromTitle;

  if (profSelect && selectedProf) {
    profSelect.value = selectedProf.uid;
  }

  if (permanentCheck) {
    const isPermanent =
      typeof block.permanent === "boolean" ? block.permanent : true;
    permanentCheck.checked = isPermanent;
  }

  // Botones
  const btnCancel = document.getElementById("btnEditCancel");
  const btnDelete = document.getElementById("btnEditDelete");
  const btnSave = document.getElementById("btnEditSave");

  if (btnCancel) {
    btnCancel.onclick = () => {
      modal.classList.add("hidden");
    };
  }

  if (btnDelete) {
    btnDelete.onclick = async () => {
      try {
        await deleteDoc(doc(db, "classSchedule", id));
        modal.classList.add("hidden");
        showAlert("Horario eliminado.", "success");
        location.reload();
      } catch (err) {
        console.error("[admin-calendario] Error al eliminar horario:", err);
        showAlert("No se pudo eliminar el horario.", "error");
      }
    };
  }

  if (btnSave) {
    btnSave.onclick = async () => {
      const startTime = startInput?.value ?? "";
      const endTime = endInput?.value ?? "";
      const type = typeInput?.value.trim() ?? "";
      const minCap = Number(minCapInput?.value || 0);
      const maxCap = Number(maxCapInput?.value || 0);
      const colorKey = resolveColorKey(
        "editColorKey",
        "editColorKeyCustom"
      );
      const profId = profSelect?.value ?? "";
      const permanent = permanentCheck ? permanentCheck.checked : true;

      const prof = professors.find((p) => p.uid === profId);

      if (!type || !startTime || !endTime || !prof) {
        showAlert("Completa tipo, horario y profesor.", "error");
        return;
      }

      try {
        await updateDoc(doc(db, "classSchedule", id), {
          startTime,
          endTime,
          type,
          minCapacity: minCap || null,
          maxCapacity: maxCap || null,
          colorKey,
          professorId: prof.uid,
          professorName: prof.name,
          permanent,
          updatedAt: serverTimestamp(),
        });

        modal.classList.add("hidden");
        showAlert("Horario actualizado correctamente.", "success");
        location.reload();
      } catch (err) {
        console.error("[admin-calendario] Error al actualizar horario:", err);
        showAlert("No se pudo actualizar el horario.", "error");
      }
    };
  }
}
