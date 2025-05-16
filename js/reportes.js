import { db } from './firebase-config.js';
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

      // Toggle sidebar
    document.getElementById('toggleNav').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');


      // Evento de cerrar sesión
      logoutSidebar.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await signOut(auth);
          showAlert("Has cerrado sesión", "success");
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1500);
        } catch (error) {
          console.error("Error al cerrar sesión:", error.message);
          showAlert("Hubo un problema al cerrar sesión.", "error");
        }

    });

  });

// Expone la función globalmente para que funcione con onclick
window.getAsistencia = async function () {
  const month = document.getElementById('monthSelect').value;
  console.log('Mes seleccionado:', month);
  const asistenciaRef = collection(db, "asistencias");

  try {
    const snapshot = await getDocs(asistenciaRef);
    console.log("Documentos encontrados en 'asistencias':", snapshot.docs.map(doc => doc.id));
    const fechasFiltradas = [];

    snapshot.forEach(docSnap => {
      const fecha = docSnap.id;
      if (fecha.startsWith(`2025-${month}`)) {
        fechasFiltradas.push(fecha);
      }
    });

    fechasFiltradas.sort();

    const container = document.getElementById("reporte-container");
    container.innerHTML = ""; // Limpiar antes de agregar nuevo contenido

    for (const fecha of fechasFiltradas) {
      const usuariosCol = collection(db, "asistencias", fecha, "usuarios");

      const usuariosSnap = await getDocs(usuariosCol);
      console.log(`Usuarios para fecha ${fecha}:`, usuariosSnap.docs.map(d => d.data()));
      const asistenciaData = [];
      usuariosSnap.forEach(doc => {
        const data = doc.data();
        asistenciaData.push({ id: doc.id, ...data });
      });

      if (asistenciaData.length > 0) {
        container.innerHTML += generarTablaPorFecha(fecha, asistenciaData);
      }
    }

  } catch (error) {
    console.error("Error al obtener asistencias:", error);
  }
};
;

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
