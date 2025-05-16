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

    const asistenciaRef = collection(db, 'asistencias');
    const snapshot = await getDocs(asistenciaRef);

    if (snapshot.empty) {
      showAlert('No hay registros de asistencia disponibles', 'error');
      return;
    }

    let datos = [["Fecha", "Nombre", "Hora", "Presente"]];

    for (const doc of snapshot.docs) {
      const fecha = doc.id;
      const usuariosRef = collection(db, `asistencias/${fecha}/usuarios`);
      const usuariosSnap = await getDocs(usuariosRef);

      const presentes = [];
      const ausentes = [];

      for (const userDoc of usuariosSnap.docs) {
      const data = userDoc.data();
        if (data.presente) {
          usuariosPresentes.push([fecha, data.nombre, data.hora, "Sí"]);
        } else {
          usuariosAusentes.push([fecha, data.nombre, data.hora, "No"]);
        }
      }

    datos = datos.concat(usuariosPresentes);
    datos = datos.concat(usuariosAusentes);

      // Ordenar por nombre
      presentes.sort((a, b) => a[1].localeCompare(b[1]));
      ausentes.sort((a, b) => a[1].localeCompare(b[1]));

      datos = datos.concat(presentes, ausentes);
    }

    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, "reporte_asistencia.xlsx");

    showAlert("Reporte descargado exitosamente", "success");
  } catch (error) {
    console.error("Error al generar el reporte:", error);
    showAlert("Hubo un error al generar el reporte", "error");
  } finally {
    boton.disabled = false;
  }
}

window.descargarReporteAsistencia = descargarReporteAsistencia;
document.getElementById('btnDescargar').addEventListener('click', descargarReporteAsistencia);
