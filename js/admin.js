import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'es',
        initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,dayGridDay'
        },
        events: function (info, successCallback, failureCallback) {
            const q = query(collection(db, 'reservations'));

            onSnapshot(q, (querySnapshot) => {
                // Contar reservas por fecha
                const dateCounts = {};

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const date = data.date;
                    if (date) {
                        if (!dateCounts[date]) {
                            dateCounts[date] = 0;
                        }
                        dateCounts[date]++;
                    }
                });

                // Convertir a eventos del calendario
                const events = Object.keys(dateCounts).map(date => ({
                title: `${dateCounts[date]}`,
                start: date,
                allDay: true
                }));

                successCallback(events);
            }, (error) => {
                console.error('Error al obtener las reservas:', error);
                failureCallback(error);
            });
        },
        eventClick: function(info) {
            // Evitar cualquier acción al hacer clic en eventos
            info.jsEvent.preventDefault();
        },

                // Bloquear días no reservables visualmente
                dayCellClassNames: function(arg) {
                  const day = arg.date.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
                  if (day !== 5 && day !== 6) { // si NO es viernes (5) ni sábado (6)
                      return ['disabled-day']; // le aplicamos la clase 'disabled-day' a días no reservables
                  }
              }
          });

    calendar.render();
});

const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showAlert("Has cerrado sesión", 'success');
        setTimeout(() => {
            window.location.href = "./index.html";
        }, 1500);
    } catch (error) {
        console.error('Error al cerrar sesión:', error.message);
        showAlert('Hubo un problema al cerrar sesión.', 'error');
    }
});
