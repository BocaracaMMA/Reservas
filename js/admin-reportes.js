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
// ──────────────────────────────────────────────────────────────────────────────
// UTILIDADES PARA RENDERIZAR
// ──────────────────────────────────────────────────────────────────────────────

// Genera el HTML de la tabla para una fecha concreta
function generarTablaPorFecha(fecha, data) {
  let tableHTML = `
    <h3>Asistencia del ${fecha}</h3>
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
  `;
  return tableHTML;
}

// Renderiza (o actualiza) la tabla de un día concreto en el DOM
function renderizarTablaEnDOM(fecha, asistenciaData) {
  const container = document.getElementById("reporte-container");
  const wrapperId = `tabla-${fecha.replace(/:/g, "-")}`;

  let wrapper = document.getElementById(wrapperId);
  if (wrapper) {
    wrapper.innerHTML = generarTablaPorFecha(fecha, asistenciaData);
  } else {
    wrapper = document.createElement("div");
    wrapper.id = wrapperId;
    wrapper.classList.add("mb-4"); // margen inferior opcional
    wrapper.innerHTML = generarTablaPorFecha(fecha, asistenciaData);
    container.appendChild(wrapper);
  }
}

// Elimina la tabla de una fecha (cuando deja de pertenecer al mes)
function eliminarTablaDeDOM(fecha) {
  const wrapperId = `tabla-${fecha.replace(/:/g, "-")}`;
  const wrapper = document.getElementById(wrapperId);
  if (wrapper) wrapper.remove();
}

//
// ──────────────────────────────────────────────────────────────────────────────
// LÓGICA EN TIEMPO REAL (MEZCLA getDocs PARA VERIFICAR Y onSnapshot PARA REFRESCAR)
// ──────────────────────────────────────────────────────────────────────────────

// Para guardar los listeners de cada subcolección “usuarios”
let subUnsubsUsuarios = {};

// Para el listener global de “asistencias”
let unsubscribeAsistencias = null;

/**
 * startRealTimeReporting(month)
 *
 * 1) Limpia el contenedor #reporte-container (para no mostrar datos viejos).
 * 2) Hace un getDocs() puntual para ver si hay documentos en “asistencias”:
 *    – Si no hay ninguno, muestra “No hay reportes para el mes seleccionado.”
 *    – Si los hay, filtra los IDs que empiecen por “YYYY-MM” y los imprime en consola.
 * 3) Sobre cada fecha filtrada, se suscribe con onSnapshot() a “asistencias/{fecha}/usuarios”:
 *    – Cada cambio en esa subcolección renderiza (o actualiza) la tabla correspondiente.
 * 4) Cancela automáticamente los listeners de fechas que ya no pertenezcan al mes seleccionado.
 */
export async function startRealTimeReporting(month) {
  const container = document.getElementById("reporte-container");
  container.innerHTML = ""; // 1) Limpiar contenedor

  const currentYear = new Date().getFullYear();
  const prefijo = `${currentYear}-${month}`; // ej. "2025-06"

  try {
    // 2) getDocs puntual para comprobar SI hay documentos en “asistencias”
    const asistenciasColl = collection(db, "asistencias");
    const snapshotAll = await getDocs(asistenciasColl);
    const fechasDisponibles = snapshotAll.docs.map((doc) => doc.id);
    console.log("→ getDocs: fechas disponibles en Firestore:", fechasDisponibles);

    // Filtrar por mes actual (“YYYY-MM”)
    const fechasDelMes = fechasDisponibles.filter((fecha) =>
      fecha.startsWith(prefijo)
    );
    console.log(`→ Fechas que coinciden con ${prefijo}:`, fechasDelMes);

    if (fechasDelMes.length === 0) {
      container.innerHTML = `<p>No hay reportes para el mes seleccionado.</p>`;
      return;
    }

    // 3) SUBSCRIBIRSE A CADA subcolección “asistencias/{fecha}/usuarios”
    fechasDelMes.forEach((fecha) => {
      if (!subUnsubsUsuarios[fecha]) {
        const usuariosRef = collection(db, "asistencias", fecha, "usuarios");
        const qUsuarios = query(usuariosRef, orderBy("hora", "asc"));

        const unsubUsuarios = onSnapshot(
          qUsuarios,
          (usuariosSnap) => {
            const asistenciaData = [];
            usuariosSnap.forEach((docUser) => {
              const data = docUser.data();
              asistenciaData.push({ id: docUser.id, ...data });
            });
            console.log(`→ Datos de asistencia para ${fecha}:`, asistenciaData);
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

    // 4) CANCELAR listeners de fechas que ya no pertenezcan al mes
    Object.keys(subUnsubsUsuarios).forEach((fechaRegistrada) => {
      if (!fechasDelMes.includes(fechaRegistrada)) {
        subUnsubsUsuarios[fechaRegistrada]();
        delete subUnsubsUsuarios[fechaRegistrada];
        eliminarTablaDeDOM(fechaRegistrada);
      }
    });

    // 5) OPCIONAL: listener “global” en toda la colección asistencias, para detectar
    //    si alguien crea/elimina un documento de fecha “{YYYY-MM-DD}” durante esta sesión.
    //    (Si no lo necesitas, puedes comentar este bloque.)
    if (unsubscribeAsistencias) unsubscribeAsistencias();
    unsubscribeAsistencias = onSnapshot(
      asistenciasColl,
      (snapshotGlobal) => {
        // Cada vez que cambie la colección “asistencias” entera, recargo el mes
        const todasFechas = snapshotGlobal.docs.map((d) => d.id);
        const fechasNuevasDelMes = todasFechas.filter((f) =>
          f.startsWith(prefijo)
        );
        // Si detectamos que cambió la lista de fechasDelMes,
        // reejecutamos esta función para refrescar listeners/tables:
        if (
          JSON.stringify(fechasNuevasDelMes.sort()) !==
          JSON.stringify(fechasDelMes.sort())
        ) {
          console.log(
            "→ Cambio detectado en colección asistencias; recargando mes."
          );
          startRealTimeReporting(month);
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

// ──────────────────────────────────────────────────────────────────────────────
// EXPONER getAsistencia AL GLOBAL
// ──────────────────────────────────────────────────────────────────────────────
window.getAsistencia = function () {
  const mes = document.getElementById("monthSelect").value; // ej. "06"
  startRealTimeReporting(mes);
};
