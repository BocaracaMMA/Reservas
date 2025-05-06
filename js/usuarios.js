import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector("#usuarios-table tbody");
  const logoutSidebar = document.getElementById("logoutSidebar");

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

  // Obtener la lista de usuarios
  const usersQuery = query(collection(db, "users"));
  onSnapshot(usersQuery, (querySnapshot) => {
    tableBody.innerHTML = ''; // Limpiar la tabla antes de agregar nuevos usuarios

    querySnapshot.forEach(docSnap => {
      const user = docSnap.data();
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${user.nombre}</td>
        <td>${user.correo}</td>
        <td>
          <label class="switch">
            <input type="checkbox" ${user.autorizado ? 'checked' : ''} data-id="${docSnap.id}">
            <span class="slider round"></span>
          </label>
        </td>
      `;

      const switchInput = row.querySelector("input[type='checkbox']");
      switchInput.addEventListener("change", async (e) => {
        const userRef = doc(db, "users", e.target.dataset.id);
        try {
          await updateDoc(userRef, { autorizado: e.target.checked });
          showAlert("Estado actualizado correctamente", "success");
        } catch (err) {
          console.error("Error al actualizar el estado:", err);
          showAlert("No se pudo actualizar el estado.", "error");
        }
      });

      tableBody.appendChild(row);
    });
  }, (err) => {
    console.error("Error al obtener usuarios:", err);
    showAlert("No se pudo cargar la lista de usuarios.", "error");
  });

  // Mostrar/ocultar navbar
  document.getElementById("toggleNav").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("hidden");
  });
});
