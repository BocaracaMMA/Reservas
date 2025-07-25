// ./js/firebase-config.js

// 1) SDKs de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getDatabase }    from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// 2) Tu configuración (reemplaza con la de tu proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyD6CUddDq2jRZ3XzNT5FfXAc-ALStQ4hdo",
  authDomain: "bocaracadb.firebaseapp.com",
  databaseURL: "https://bocaracadb-default-rtdb.firebaseio.com",
  projectId: "bocaracadb",
  storageBucket: "bocaracadb.appspot.com",    // asegúrate de que coincide
  messagingSenderId: "420681635696",
  appId: "1:420681635696:web:c4c1a47be59fb45912a1b5",
  measurementId: "G-QZS4RL1H5Q"
};

// 3) Inicializar servicios
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const storage   = getStorage(app);
const database  = getDatabase(app);

// 4) Exportar para usarlos en el resto de módulos
export { app, auth, db, storage, database, firebaseConfig };
