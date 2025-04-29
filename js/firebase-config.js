// Importar las bibliotecas de Firebase necesarias
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Tu configuración de Firebase (reemplaza con la configuración de tu proyecto)
const firebaseConfig = {
    apiKey: "AIzaSyD6CUddDq2jRZ3XzNT5FfXAc-ALStQ4hdo",
    authDomain: "bocaracadb.firebaseapp.com",
    projectId: "bocaracadb",
    storageBucket: "bocaracadb.appspot.com",
    messagingSenderId: "420681635696",
    appId: "1:420681635696:web:c4c1a47be59fb45912a1b5",
    measurementId: "G-QZS4RL1H5Q"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Auth y Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// Exportar para su uso en otros archivos
export { app, auth, db };  // Ahora exportamos 'app' también
