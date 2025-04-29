const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Función de Firebase Cloud Functions para asignar el rol de admin
exports.assignAdminRole = functions.https.onRequest((req, res) => {
  // Solo los administradores pueden llamar a esta función
  const uid = req.query.uid;  // Se obtiene el UID del usuario desde los parámetros de la solicitud

  if (!uid) {
    return res.status(400).send('No UID provided');
  }

  // Asignar el rol de administrador
  admin.auth().setCustomUserClaims(uid, { admin: true })
    .then(() => {
      res.status(200).send(`Rol de administrador asignado al usuario con UID: ${uid}`);
    })
    .catch((error) => {
      console.error('Error al asignar rol de administrador:', error);
      res.status(500).send('Error al asignar el rol');
    });
});
