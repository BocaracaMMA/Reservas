// ./js/descargar-reportes.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { showAlert } from './showAlert.js';

async function descargarReporteAsistencia() {
  const boton = document.getElementById('btnDescargar');
  boton.disabled = true;

  try {
    if (typeof XLSX === "undefined") {
      showAlert("La librería XLSX no está cargada", "error");
      return;
    }

    // 1) Obtenemos todas las fechas disponibles en 'asistencias'
    const asistenciaRef = collection(db, 'asistencias');
    const snapshot = await getDocs(asistenciaRef);

    if (snapshot.empty) {
      showAlert('No hay registros de asistencia disponibles', 'error');
      return;
    }

    // 2) Encabezado para el Excel
    let datos = [["Fecha", "Nombre", "Hora", "Presente"]];

    // 3) Recorremos cada documento de 'asistencias'
    for (const docAsist of snapshot.docs) {
      const fecha = docAsist.id; // ej. "2025-06-07"

      // 4) Obtenemos subcolección "usuarios" para esa fecha
      const usuariosRef = collection(db, `asistencias/${fecha}/usuarios`);
      const usuariosSnap = await getDocs(usuariosRef);

      // 5) Para cada usuario dentro de esa fecha, concatenamos una fila en 'datos'
      usuariosSnap.forEach((userDoc) => {
        const data = userDoc.data();
        // data.presente es booleano; lo transformamos a "Sí" o "No"
        datos.push([fecha, data.nombre, data.hora, data.presente ? "Sí" : "No"]);
      });
    }

    // 6) (Opcional) Ordenar las filas por Fecha, luego Nombre
    //    Extraemos el encabezado y ordenamos solo el resto
    const encabezado = datos.shift(); // ["Fecha","Nombre","Hora","Presente"]
    datos.sort((a, b) => {
      // Primero orden por fecha (string "YYYY-MM-DD")
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      // Si la misma fecha, orden por nombre
      return a[1].localeCompare(b[1]);
    });
    datos.unshift(encabezado);

    // 7) Convertir a hoja de cálculo y forzar descarga
    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

    // El nombre del archivo puede llevar la fecha de hoy o simplemente ser fijo
    XLSX.writeFile(wb, "reporte_asistencia.xlsx");

    showAlert("Reporte descargado exitosamente", "success");
  } catch (error) {
    console.error("Error al generar el reporte:", error);
    showAlert("Hubo un error al generar el reporte", "error");
  } finally {
    boton.disabled = false;
  }
}

// Exponer la función globalmente para que el botón la invoque
window.descargarReporteAsistencia = descargarReporteAsistencia;

// Asociamos el listener al botón al cargar el script
document.getElementById('btnDescargar').addEventListener('click', descargarReporteAsistencia);
