import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function gateAdminPage({
  onDenyAnon = './index.html',
  onDenyNoAdmin = './client-dashboard.html',
} = {}) {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, async (user) => {
      try {
        // Sin sesión ⇒ fuera
        if (!user) {
          location.href = onDenyAnon;
          resolve();
          return;
        }

        // Leer roles del doc de usuario (sin romper si falla)
        let roles = [];
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const data = snap.data() || {};
          if (Array.isArray(data.roles)) roles = data.roles;
        } catch (e) {
          console.warn('[gateAdminPage] No se pudieron leer roles:', e);
        }

        // Solo admins
        const isAdmin = roles.includes('admin');
        if (!isAdmin) {
          location.href = onDenyNoAdmin;
          resolve();
          return;
        }

        // Admin OK
        resolve();
      } finally {
        try { stop(); } catch {}
      }
    });
  });
}
