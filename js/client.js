import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Asegúrate de importar getDocs
import { showAlert } from './showAlert.js';

let calendar;

document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'es',
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,dayGridDay'
        },
        events: function (info, successCallback, failureCallback) {
            const q = query(collection(db, 'reservations'), where('date', '>=', info.startStr), where('date', '<=', info.endStr));
            
            // Usamos onSnapshot() para recibir actualizaciones en tiempo real
            onSnapshot(q, (querySnapshot) => {
                const events = querySnapshot.docs
                    .filter(doc => {
                        const data = doc.data();
                        return !data.user || data.user === auth.currentUser.email;
                    })
                    .map(doc => {
                        const reservation = doc.data();
                        return {
                            title: `Clase MMA - ${reservation.time}`,
                            start: `${reservation.date}T${reservation.time}:00`,
                            allDay: false,
                            id: doc.id,
                        };
                    });
                successCallback(events);  // Actualiza el calendario con los nuevos eventos
            }, (err) => {
                console.error('Error al obtener las reservas en tiempo real:', err);
                failureCallback(err);  // Maneja errores si ocurren
            });
        },
        eventContent: function(arg) {
            return {
                html: '<div style="font-size: 20px; color: green; text-align: center;">✔️</div>'
            };
        },
        dateClick: function (info) {
            const selectedDate = info.date;
            const dayOfWeek = selectedDate.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
        
            // Corregir la fecha a UTC-6
            const adjustedDate = new Date(selectedDate.getTime() - (6 * 60 * 60 * 1000)); // Restamos 6 horas
        
            if (dayOfWeek === 5 || dayOfWeek === 6) { // viernes o sábado
                const selectedTime = dayOfWeek === 5 ? '20:30' : '09:00';
        
                checkExistingReservation(adjustedDate.toISOString().split('T')[0], selectedTime)
                    .then((exists) => {
                        if (exists) {
                            showAlert(`Ya tienes una reserva para el ${adjustedDate.toLocaleDateString()} a las ${selectedTime}.`, 'error');
                        } else {
                            openConfirmReservationModal(adjustedDate.toISOString().split('T')[0], selectedTime);
                        }
                    })
                    .catch((err) => {
                        console.error('Error al verificar reserva:', err);
                        showAlert('Error al verificar reserva.', 'error');
                    });
            } else {
                showAlert('Solo puedes reservar clases los viernes y sábados.', 'error');
            }
        },
        
        eventClick: function (info) {
            const event = info.event;
            openDeleteReservationModal(event.id, event.startStr, event.title.split(" - ")[1]);
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

async function checkExistingReservation(date, time) {
    const q = query(
        collection(db, 'reservations'),
        where('date', '==', date),
        where('time', '==', time),
        where('user', '==', auth.currentUser.email)
    );
    const snapshot = await getDocs(q);  // Se usa getDocs aquí
    return snapshot.docs.length > 0;
}

async function addReservation(date, time) {
    await addDoc(collection(db, 'reservations'), {
        date: date,
        time: time,
        user: auth.currentUser.email,
    });
}

async function deleteReservation(reservationId) {
    const reservationRef = doc(db, 'reservations', reservationId);
    await deleteDoc(reservationRef);
}

function openConfirmReservationModal(date, time) {
    closeModal();
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <p>¿Confirmar reserva para el ${date} a las ${time}?</p>
            <button id="confirmBtn">Confirmar</button>
            <button id="cancelBtn">Cancelar</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirmBtn').onclick = async () => {
        try {
            await addReservation(date, time);
            showAlert('Reserva confirmada', 'success');
            closeModal();
            calendar.refetchEvents();
        } catch (err) {
            console.error('Error al confirmar reserva:', err);
            showAlert('Error al confirmar reserva.', 'error');
        }
    };

    document.getElementById('cancelBtn').onclick = closeModal;
}

function openDeleteReservationModal(reservationId, date, time) {
    closeModal();
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <p>¿Eliminar reserva para el ${date} a las ${time}?</p>
            <button id="deleteBtn">Eliminar</button>
            <button id="cancelDeleteBtn">Cancelar</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('deleteBtn').onclick = async () => {
        try {
            await deleteReservation(reservationId);
            showAlert('Reserva eliminada', 'success');
            closeModal();
            calendar.refetchEvents();
        } catch (err) {
            console.error('Error al eliminar reserva:', err);
            showAlert('Error al eliminar reserva.', 'error');
        }
    };

    document.getElementById('cancelDeleteBtn').onclick = closeModal;
}

function closeModal() {
    const existingModal = document.querySelector('.custom-modal');
    if (existingModal) existingModal.remove();
}

const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showAlert("Has cerrado sesión", 'success');
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);
    } catch (error) {
        console.error('Error al cerrar sesión:', error.message);
        showAlert('Hubo un problema al cerrar sesión.', 'error');
    }
});
