import { db } from './firebase-config.js';
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Expone la función globalmente para que funcione con onclick
window.getAsistencia = async function () {
  const month = document.getElementById('monthSelect').value;
  const asistenciaRef = collection(db, "asistencias");

  try {
    const snapshot = await getDocs(asistenciaRef);
    const fechasFiltradas = [];

    snapshot.forEach(docSnap => {
      const fecha = docSnap.id;
      if (fecha.startsWith(`2025-${month}`)) {
        fechasFiltradas.push(fecha);
      }
    });

    // Ordenar fechas
    fechasFiltradas.sort();

    const container = document.getElementById("reporte-container");
    container.innerHTML = ""; // Limpiar antes de agregar nuevo contenido

    // Para cada fecha en el mes seleccionado, creamos una vista de las asistencias
    for (const fecha of fechasFiltradas) {
      const usuariosCol = collection(db, "asistencias", fecha, "usuarios");

      // Escuchar los cambios en tiempo real para las subcolecciones de 'usuarios'
      onSnapshot(usuariosCol, (querySnapshot) => {
        const asistenciaData = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          asistenciaData.push({ id: doc.id, ...data });
        });

        // Agregar la tabla por fecha
        container.innerHTML += generarTablaPorFecha(fecha, asistenciaData);
      });
    }

  } catch (error) {
    console.error("Error al obtener asistencias:", error);
  }
};

// Genera la tabla HTML para una fecha específica con los usuarios y su estado de presencia
function generarTablaPorFecha(fecha, data) {
  if (data.length === 0) {
    return `<p>No hay registros de asistencia para ${fecha}.</p>`;
  }

  let tableHTML = `
    <h3>Asistencia para ${fecha}</h3>
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

  data.forEach(user => {
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

// Detectar cuando el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutSidebar");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(getAuth());
        window.location.href = './index.html';
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
      }
    });
  }

  const toggleButton = document.getElementById("toggleNav");
  const sidebar = document.getElementById("sidebar");

  toggleButton.addEventListener("click", () => {
      sidebar.classList.toggle("active");
  });

  // Si usas Lucide icons
  lucide.createIcons();


  // Toggle sidebar
document.getElementById('toggleNav').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('active');
});

});
