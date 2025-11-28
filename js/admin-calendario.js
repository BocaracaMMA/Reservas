// ./js/admin-calendario.js
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from "./showAlert.js";

/* ---------------------------------------------------------------------------
   Constantes
--------------------------------------------------------------------------- */

const PRESET_COLOR_KEYS = ["MMA - GENERAL", "SPARRING", "PRIVADA"];

const COLOR_MAP = {
  "MMA - GENERAL": "#3b82f6",
  SPARRING: "#f97316",
  PRIVADA: "#22c55e",
};

const FALLBACK_COLORS = [
  "#ec4899",
  "#8b5cf6",
  "#eab308",
  "#06b6d4",
  "#f97316",
  "#10b981",
];

const EXCEPTIONS_COLLECTION = "calendarExceptions";

/* ---------------------------------------------------------------------------
   Helpers colores
--------------------------------------------------------------------------- */

function getColorForKey(rawKey) {
  const key = (rawKey || "").trim();
  if (!key) return "#3b6cff";

  if (COLOR_MAP[key]) return COLOR_MAP[key];

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  const idx = hash % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[idx];
}

function resolveColorKey(selectId, customId) {
  const sel = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  if (!sel) return "";

  if (sel.value === "_custom" && custom && custom.value.trim()) {
    return custom.value.trim();
  }
  return sel.value || "";
}

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

  toggle();
  select.addEventListener("change", toggle);
}

/* ---------------------------------------------------------------------------
   Arranque
--------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  setupColorKeyDropdowns();
  setupSpecialDaysToggle();
  enhanceSpecialDateInput();
  setupSpecialDaysFormHandlers();

  initAdminScheduleCalendar().catch((err) => {
    console.error("[admin-calendario] Error inicializando calendario:", err);
    showAlert("No se pudo cargar el calendario de configuración.", "error");
  });
});

/* ---------------------------------------------------------------------------
   Carga de datos base (horario + profesores)
--------------------------------------------------------------------------- */

async function loadClassSchedule() {
  const ref = collection(db, "classSchedule");
  const snap = await getDocs(ref);

  const blocks = [];
  snap.forEach((docSnap) => {
    blocks.push({ id: docSnap.id, ...docSnap.data() });
  });

  return blocks;
}

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

/* ---------------------------------------------------------------------------
   Construcción de eventos de calendario
--------------------------------------------------------------------------- */

function buildEvents(blocks) {
  return blocks
    .filter((b) => b.active !== false)
    .map((b) => {
      const isPermanent =
        typeof b.permanent === "boolean" ? b.permanent : true;

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

/* ---------------------------------------------------------------------------
   Inicialización FullCalendar
--------------------------------------------------------------------------- */

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

  const [classBlocks, professors] = await Promise.all([
    loadClassSchedule(),
    loadProfessors(),
  ]);

  fillProfessorSelects(professors);
  const activeDays = getActiveDays(classBlocks);

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
    nowIndicator: true,
    slotLabelFormat: {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
    eventTimeFormat: {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
    dayHeaderFormat: {
      weekday: "short",
      day: "2-digit",
    },

    events: buildEvents(classBlocks),

    dayCellClassNames(arg) {
      const dow = arg.date.getDay();
      return activeDays.has(dow) ? [] : ["disabled-day"];
    },

    dateClick(info) {
      openCreateModal(info, professors);
    },

    eventClick(info) {
      openEditModal(info, professors, classBlocks);
    },
  });

  calendar.render();
}

/* ---------------------------------------------------------------------------
   Modales crear / editar bloques
--------------------------------------------------------------------------- */

function openCreateModal(info, professors) {
  const modal = document.getElementById("modalCreateClass");
  if (!modal) return;

  modal.classList.remove("hidden");

  const btnCancel = document.getElementById("btnCreateCancel");
  const btnSave = document.getElementById("btnCreateSave");

  btnCancel &&
    (btnCancel.onclick = () => {
      modal.classList.add("hidden");
    });

  if (btnSave) {
    btnSave.onclick = async () => {
      const type = document.getElementById("createType")?.value.trim() ?? "";
      const startTime =
        document.getElementById("createStartTime")?.value ?? "";
      const endTime = document.getElementById("createEndTime")?.value ?? "";
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
        : true;

      const prof = professors.find((p) => p.uid === profId);

      if (!type || !startTime || !endTime || !prof) {
        showAlert("Completa tipo, horario y profesor.", "error");
        return;
      }

      try {
        await addDoc(collection(db, "classSchedule"), {
          dayOfWeek: info.date.getUTCDay(),
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
        location.reload();
      } catch (err) {
        console.error("[admin-calendario] Error al crear horario:", err);
        showAlert("No se pudo guardar el horario.", "error");
      }
    };
  }
}

function openEditModal(info, professors, classBlocks) {
  const modal = document.getElementById("modalEditClass");
  if (!modal) return;

  modal.classList.remove("hidden");

  const id = info.event.id;
  document.getElementById("editId").value = id;

  const block = classBlocks.find((b) => b.id === id) || {};
  const [typeFromTitle, professorNameFromTitle] =
    (info.event.title || "").split(" - ");

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

  const btnCancel = document.getElementById("btnEditCancel");
  const btnDelete = document.getElementById("btnEditDelete");
  const btnSave = document.getElementById("btnEditSave");

  btnCancel &&
    (btnCancel.onclick = () => {
      modal.classList.add("hidden");
    });

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
      const colorKey = resolveColorKey("editColorKey", "editColorKeyCustom");
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

/* ---------------------------------------------------------------------------
   UI: Accordion + input fecha
--------------------------------------------------------------------------- */

function setupSpecialDaysToggle() {
  const btn = document.getElementById("specialDaysToggle");
  const body = document.getElementById("specialDaysBody");
  if (!btn || !body) return;

  btn.setAttribute("aria-expanded", "true");
  body.classList.remove("collapsed");

  btn.addEventListener("click", () => {
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    body.classList.toggle("collapsed", isOpen);
  });
}

function enhanceSpecialDateInput() {
  const dateInput = document.getElementById("specialDate");
  if (!dateInput) return;

  dateInput.addEventListener("focus", () => {
    if (typeof dateInput.showPicker === "function") {
      dateInput.showPicker();
    }
  });
}

/* ---------------------------------------------------------------------------
   Lógica DÍAS ESPECIALES (calendarExceptions)
--------------------------------------------------------------------------- */

function getSpecialDateISO() {
  const input = document.getElementById("specialDate");
  if (!input || !input.value) return null;
  // type="date" => "YYYY-MM-DD"
  return input.value;
}

function clearSpecialFormFields() {
  const ids = [
    "specialReason",
    "specialTitle",
    "specialStart",
    "specialEnd",
    "specialMinCap",
    "specialMaxCap",
    "specialProfessor",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function clearSpecialConfigForDate(dateStr) {
  const blockId = `${dateStr}-block`;
  const overrideId = `${dateStr}-override`;
  try {
    await deleteDoc(doc(db, EXCEPTIONS_COLLECTION, blockId));
  } catch (e) {
    /* ignore */
  }
  try {
    await deleteDoc(doc(db, EXCEPTIONS_COLLECTION, overrideId));
  } catch (e) {
    /* ignore */
  }
}

async function loadSpecialConfigForDate(dateStr) {
  const typeNone = document.getElementById("specialTypeNone");
  const typeBlock = document.getElementById("specialTypeBlock");
  const typeOverride = document.getElementById("specialTypeOverride");

  const reasonInput = document.getElementById("specialReason");
  const titleInput = document.getElementById("specialTitle");
  const startInput = document.getElementById("specialStart");
  const endInput = document.getElementById("specialEnd");
  const minCapInput = document.getElementById("specialMinCap");
  const maxCapInput = document.getElementById("specialMaxCap");
  const profInput = document.getElementById("specialProfessor");

  clearSpecialFormFields();
  if (typeNone) typeNone.checked = true;
  if (typeBlock) typeBlock.checked = false;
  if (typeOverride) typeOverride.checked = false;

  const blockId = `${dateStr}-block`;
  const overrideId = `${dateStr}-override`;

  const [blockSnap, overrideSnap] = await Promise.all([
    getDoc(doc(db, EXCEPTIONS_COLLECTION, blockId)),
    getDoc(doc(db, EXCEPTIONS_COLLECTION, overrideId)),
  ]);

  if (overrideSnap.exists()) {
    const data = overrideSnap.data() || {};
    const slot =
      Array.isArray(data.overrideSlots) && data.overrideSlots[0]
        ? data.overrideSlots[0]
        : {};

    if (typeOverride) typeOverride.checked = true;
    if (typeNone) typeNone.checked = false;

    if (reasonInput) reasonInput.value = data.reason || "";
    if (titleInput) titleInput.value = slot.type || "";
    if (startInput) startInput.value = slot.startTime || "";
    if (endInput) endInput.value = slot.endTime || "";
    if (minCapInput)
      minCapInput.value =
        typeof slot.minCapacity === "number" ? slot.minCapacity : "";
    if (maxCapInput)
      maxCapInput.value =
        typeof slot.maxCapacity === "number" ? slot.maxCapacity : "";
    if (profInput) profInput.value = slot.professorName || "";

    showAlert("Se cargó la configuración especial de ese día.", "success");
    return;
  }

  if (blockSnap.exists()) {
    const data = blockSnap.data() || {};
    if (typeBlock) typeBlock.checked = true;
    if (typeNone) typeNone.checked = false;
    if (reasonInput) reasonInput.value = data.reason || "";
    showAlert("Se cargó la configuración de día bloqueado.", "success");
    return;
  }

  showAlert(
    "No hay configuración especial guardada para esa fecha.",
    "error"
  );
}

async function saveSpecialConfig() {
  const dateStr = getSpecialDateISO();
  if (!dateStr) {
    showAlert("Selecciona una fecha para la excepción.", "error");
    return;
  }

  const typeRadio = document.querySelector(
    'input[name="specialType"]:checked'
  );
  const typeValue = typeRadio ? typeRadio.value : "none";

  const reasonInput = document.getElementById("specialReason");
  const titleInput = document.getElementById("specialTitle");
  const startInput = document.getElementById("specialStart");
  const endInput = document.getElementById("specialEnd");
  const minCapInput = document.getElementById("specialMinCap");
  const maxCapInput = document.getElementById("specialMaxCap");
  const profInput = document.getElementById("specialProfessor");

  const reason = reasonInput?.value.trim() || "";

  if (typeValue === "none") {
    await clearSpecialConfigForDate(dateStr);
    clearSpecialFormFields();
    showAlert(
      "Se eliminaron las configuraciones especiales y el día vuelve al horario base.",
      "success"
    );
    return;
  }

  if (typeValue === "block") {
    const docId = `${dateStr}-block`;
    await setDoc(
      doc(db, EXCEPTIONS_COLLECTION, docId),
      {
        action: "block",
        date: dateStr,
        reason: reason || null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Por si existía un override viejo lo borramos
    try {
      await deleteDoc(
        doc(db, EXCEPTIONS_COLLECTION, `${dateStr}-override`)
      );
    } catch (e) {
      /* ignore */
    }

    clearSpecialFormFields();
    showAlert("Se guardó el día como bloqueado.", "success");
    return;
  }

  if (typeValue === "override") {
    const title = titleInput?.value.trim() || "";
    const startTime = startInput?.value || "";
    const endTime = endInput?.value || "";
    const minCapRaw = minCapInput?.value || "";
    const maxCapRaw = maxCapInput?.value || "";
    const professorName = profInput?.value.trim() || "";

    if (!title || !startTime || !endTime) {
      showAlert(
        "Completa el tipo de clase/evento y las horas de inicio y fin.",
        "error"
      );
      return;
    }

    const minCapNum = Number(minCapRaw);
    const maxCapNum = Number(maxCapRaw);

    const slot = {
      type: title,
      startTime,
      endTime,
      minCapacity:
        Number.isFinite(minCapNum) && minCapNum > 0 ? minCapNum : null,
      maxCapacity:
        Number.isFinite(maxCapNum) && maxCapNum > 0 ? maxCapNum : null,
      professorId: null,
      professorName: professorName || null,
    };

    const docId = `${dateStr}-override`;
    await setDoc(
      doc(db, EXCEPTIONS_COLLECTION, docId),
      {
        action: "override",
        date: dateStr,
        reason: reason || null,
        overrideSlots: [slot],
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Por si existía un block viejo lo borramos
    try {
      await deleteDoc(
        doc(db, EXCEPTIONS_COLLECTION, `${dateStr}-block`)
      );
    } catch (e) {
      /* ignore */
    }

    showAlert("Se guardó el horario especial para ese día.", "success");
  }
}

async function onSpecialClearClicked() {
  const dateStr = getSpecialDateISO();
  if (!dateStr) {
    showAlert("Selecciona una fecha primero.", "error");
    return;
  }

  await clearSpecialConfigForDate(dateStr);
  clearSpecialFormFields();

  const typeNone = document.getElementById("specialTypeNone");
  if (typeNone) typeNone.checked = true;

  showAlert("Se quitó la excepción para ese día.", "success");
}

function setupSpecialDaysFormHandlers() {
  const btnLoad = document.getElementById("btnSpecialLoadDay");
  const btnSave = document.getElementById("btnSpecialSave");
  const btnClear = document.getElementById("btnSpecialClear");

  if (btnLoad && !btnLoad.dataset.bound) {
    btnLoad.addEventListener("click", async (e) => {
      e.preventDefault();
      const dateStr = getSpecialDateISO();
      if (!dateStr) {
        showAlert(
          "Selecciona una fecha para cargar la configuración.",
          "error"
        );
        return;
      }
      try {
        await loadSpecialConfigForDate(dateStr);
      } catch (err) {
        console.error(err);
        showAlert(
          "No se pudo cargar la configuración de ese día.",
          "error"
        );
      }
    });
    btnLoad.dataset.bound = "1";
  }

  if (btnSave && !btnSave.dataset.bound) {
    btnSave.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await saveSpecialConfig();
      } catch (err) {
        console.error(err);
        showAlert("No se pudo guardar la configuración.", "error");
      }
    });
    btnSave.dataset.bound = "1";
  }

  if (btnClear && !btnClear.dataset.bound) {
    btnClear.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await onSpecialClearClicked();
      } catch (err) {
        console.error(err);
        showAlert("No se pudo quitar la excepción.", "error");
      }
    });
    btnClear.dataset.bound = "1";
  }
}
