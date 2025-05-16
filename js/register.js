import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Formulario
const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("nombre").value.trim();
  const cedula = document.getElementById("cedula").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!fullName || !cedula || !phone || !email || !password) {
    showToast("Por favor, completa todos los campos", "error");
    return;
  }

    // 🟡 Validación de formato para cédula y celular
  const cedulaRegex = /^\d{9}$/;
  if (!cedulaRegex.test(cedula)) {
    showToast("La cédula debe contener exactamente 9 dígitos, incluido los 0 y sin guiones", "error");
    return;
  }

  const phoneRegex = /^\d{8}$/;
  if (!phoneRegex.test(phone)) {
    showToast("El celular debe contener exactamente 8 dígitos", "error");
    return;
  }

  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;

  if (!nameRegex.test(fullName)) {
    showToast("El nombre solo debe contener letras y espacios", "error");
    return;
  }

  try {
    // Verificar si la cédula ya existe
    const q = query(collection(db, "users"), where("cedula", "==", cedula));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      showToast("Ya existe un usuario registrado con esta cédula", "error");
      return;
    }

    // Crear el usuario en Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Guardar información en Firestore en /users/{uid}
    console.log("🔥 Guardando en Firestore...");
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      nombre: fullName,
      cedula,
      correo: email.toLowerCase(),
      celular: phone,
      autorizado: false,
      reservas: 0,
    });
    console.log("✅ Documento guardado correctamente");

    showToast("Registro exitoso. Redirigiendo...", "success");

  // Cierra sesión y redirige al login
  setTimeout(async () => {
    await signOut(auth);
    window.location.href = "./index.html"; // O "./login.html" si ese es tu archivo
  }, 2000);

  } catch (error) {
    console.log("🔥 ERROR DETECTADO:", error); // <-- Añade esta línea
    const mensaje = mapAuthError(error.code);
    showToast(mensaje, "error");
  }
  if (error.code === "auth/popup-blocked") {
  showToast("Activa las ventanas emergentes o usa otro navegador", "error");
}
});

// Función para mostrar mensajes
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Mapeo de errores de Firebase
function mapAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Este correo ya está registrado";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres";
    case "auth/invalid-email":
      return "El correo no es válido";
    default:
      return "Error al registrar. Intenta de nuevo.";
  }
}

// Bloquear letras en cedula y celular
document.getElementById('cedula').addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '');
});

document.getElementById('phone').addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '');
});