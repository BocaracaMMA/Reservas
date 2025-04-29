import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { showToast } from './toast.js'; // 👈 Asegúrate que puedes importar tu función showToast si tu sistema lo permite

const resetPasswordForm = document.getElementById('resetPasswordForm');
const emailInput = document.getElementById('email');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const loader = document.getElementById('loader');

resetPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  if (!email) {
    showToast('Por favor, ingresa tu correo.', 'error'); // 👈 Toast de error
    return;
  }

  loader.style.display = 'block'; 
  resetPasswordForm.style.display = 'none'; 

  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Te hemos enviado un correo para restablecer tu contraseña.', 'success'); // 👈 Toast de éxito
    setTimeout(() => {
      window.location.href = './index.html';
    }, 2000); // Espera 2 segundos para que el usuario vea el toast
  } catch (error) {
    console.error('Error al enviar el email:', error.message);
    showToast(`Error: ${error.message}`, 'error'); // 👈 Toast de error
    loader.style.display = 'none';
    resetPasswordForm.style.display = 'flex';
  }
});

cancelResetBtn.addEventListener('click', () => {
  window.location.href = './index.html';
});
