import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Función de alertas visuales
import { showAlert } from './showAlert.js';

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

// Obtener el contador de intentos fallidos desde localStorage (si existe)
let failedAttempts = parseInt(localStorage.getItem('failedAttempts')) || 0;

// Mostrar o ocultar el enlace de cambio de contraseña
if (failedAttempts >= 3) {
    forgotPasswordLink.style.display = 'block';  // Hacer visible el enlace
} else {
    forgotPasswordLink.style.display = 'none';   // Ocultar el enlace
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        showAlert("Por favor, ingrese un correo electrónico y una contraseña.", 'error');
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Verificamos si el objeto 'user' no es null y tiene la propiedad email
        if (user && user.email) {
            showAlert("¡Bienvenido!", 'success');
            localStorage.setItem('failedAttempts', 0); // Reiniciar los intentos fallidos en el login

            // Redirigir después de un pequeño delay
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

        // Incrementar el contador de intentos fallidos
        failedAttempts++;
        localStorage.setItem('failedAttempts', failedAttempts);

        // Si el número de intentos fallidos llega a 3, habilitar el enlace
        if (failedAttempts >= 3) {
            forgotPasswordLink.style.display = 'block';  // Mostrar el enlace
        }
    }
});
