// ./js/login.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { showAlert } from './showAlert.js';
import { markLoginActivity } from './visibility-rules.js';

// Lista de correos de administradores
const adminEmails = [
  "luis.davidsolorzano@outlook.es",
  "ivan.cicc@hotmail.com"
];

// Obtener el formulario y los elementos
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const forgotPasswordLink = document.getElementById('forgotPasswordLink'); // Enlace de cambio de contraseña

// Contador de intentos fallidos
let failedAttempts = parseInt(localStorage.getItem('failedAttempts')) || 0;
forgotPasswordLink.style.display = (failedAttempts >= 3) ? 'block' : 'none';

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value?.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAlert("Por favor, ingrese un correo electrónico y una contraseña.", 'error');
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user && user.email) {
      // ← Reactiva visibilidad (última actividad = ahora)
      await markLoginActivity(user.uid);

      showAlert("¡Bienvenido!👍", 'success');
      localStorage.setItem('failedAttempts', 0);

      setTimeout(() => {
        if (adminEmails.includes(user.email)) {
          window.location.href = "./admin-dashboard.html";
        } else {
          window.location.href = "./client-dashboard.html";
        }
      }, 1500);
    } else {
      showAlert("Error: No se pudo iniciar sesión correctamente.", 'error');
    }

  } catch (error) {
    console.error('Error al iniciar sesión:', error.code, error.message);
    showAlert(`Error: ${error.code} - ${error.message}`, 'error');

    failedAttempts++;
    localStorage.setItem('failedAttempts', failedAttempts);
    if (failedAttempts >= 3) {
      forgotPasswordLink.style.display = 'block';
    }
  }
});
