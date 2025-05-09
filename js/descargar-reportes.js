import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';

async function descargarReporteAsistencia() {
  try {
    const asistenciaRef = collection(db, 'asistencias');
    const snapshot = await getDocs(asistenciaRef);
    console.log("Número de documentos en 'asistencias':", snapshot.size);

    if (snapshot.empty) {
      console.log("No se encontraron documentos en la colección 'asistencias'");
      return;
    }

    let datosPresentes = [["Fecha", "Nombre", "Hora", "Presente"]];
    let datosAusentes = [["Fecha", "Nombre", "Hora", "Presente"]];

    for (const doc of snapshot.docs) {
      const fecha = doc.id;
      console.log("Procesando fecha:", fecha);

      const usuariosRef = collection(db, `asistencias/${fecha}/usuarios`);
      const usuariosSnap = await getDocs(usuariosRef);
      console.log("Número de usuarios en esta fecha:", usuariosSnap.size);

      if (usuariosSnap.empty) {
        console.log("No hay usuarios registrados en la fecha:", fecha);
        continue;
      }

      usuariosSnap.forEach(userDoc => {
        const data = userDoc.data();
        console.log("Usuario encontrado:", data);

        if (data.presente) {
          datosPresentes.push([
            fecha,
            data.nombre,
            data.hora,
            "Sí"
          ]);
        } else {
          datosAusentes.push([
            fecha,
            data.nombre,
            data.hora,
            "No"
          ]);
        }
      });
    }

    if (datosPresentes.length === 1 && datosAusentes.length === 1) {
      console.log("No se encontraron registros de asistencia para el mes actual.");
      alert("No se encontraron registros de asistencia para el mes actual.");
      return;
    }

    const wsPresentes = XLSX.utils.aoa_to_sheet(datosPresentes);
    const wsAusentes = XLSX.utils.aoa_to_sheet(datosAusentes);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsPresentes, "Presentes");
    XLSX.utils.book_append_sheet(wb, wsAusentes, "Ausentes");
    XLSX.writeFile(wb, "reporte_asistencia.xlsx");

  } catch (error) {
    console.error("Error al generar el reporte:", error);
  }
}

window.descargarReporteAsistencia = descargarReporteAsistencia;
document.getElementById('btnDescargar').addEventListener('click', descargarReporteAsistencia);
