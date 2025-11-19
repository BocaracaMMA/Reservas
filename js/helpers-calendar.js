/**
 * helpers-calendar.js
 * Funciones compartidas para calendarios de toda la plataforma.
 * Proveen:
 * - Días activos desde classSchedule
 * - Carga de bloques de horarios
 * - Utilidades para validación
 */

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =============================================================================
   Carga de días activos de clase (0=domingo...6=sábado)
   Si no hay bloques permanentes, retorna viernes y sábado por compatibilidad.
   ========================================================================== */

export async function loadActiveDays(db) {
  const ref = collection(db, "classSchedule");
  const snap = await getDocs(ref);

  const set = new Set();

  snap.forEach(docSnap => {
    const d = docSnap.data();
    // Si permanent falta, lo interpretamos como true
    if (d.permanent !== false) {
      set.add(d.dayOfWeek);
    }
  });

  // Fallback de compatibilidad si no hay nada creado
  if (set.size === 0) {
    set.add(5); // viernes
    set.add(6); // sábado
  }

  return set;
}

/* =============================================================================
   Carga completa de bloques de horarios
   ========================================================================== */

export async function loadClassBlocks(db) {
  const ref = collection(db, "classSchedule");
  const snap = await getDocs(ref);

  const arr = [];
  snap.forEach(docSnap =>
    arr.push({ id: docSnap.id, ...docSnap.data() })
  );
  return arr;
}

/* =============================================================================
   Busca un bloque de clase por día y hora exacta
   ========================================================================== */

export function findBlockForDayTime(blocks, day, timeStr) {
  return blocks.find(b =>
    b.dayOfWeek === day &&
    b.startTime === timeStr
  );
}

/* =============================================================================
   Determina si un día es activo o no según classSchedule
   ========================================================================== */

export function isActiveDay(activeDays, day) {
  return activeDays.has(day);
}
