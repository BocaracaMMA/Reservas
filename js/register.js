// register.js
import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Función de alertas visuales
import { showAlert } from './showAlert.js'; // (asegúrate de tener este archivo o este código en tu proyecto)

// Obtener el formulario
const registerForm = document.getElementById('registerForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

registerForm.addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    // Crear usuario
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    showAlert("Usuario registrado exitosamente: " + email, 'success');

    // Redirigir después de un pequeño delay para ver la alerta
    setTimeout(() => {
      window.location.href = "./index.html"; 
    }, 1500);

  } catch (error) {
    console.error('Error en el registro:', error.message);
    showAlert('Error al registrar: ' + error.message, 'error');
  }
});
