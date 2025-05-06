import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    collection,
    query,
    onSnapshot,
    getDoc,
    getDocs,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', () => {
    const ADMIN_UIDS = [
        "TWAkND9zF0UKdMzswAPkgas9zfL2", // ivan
        "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"  // luis
    ];

    onAuthStateChanged(auth, (user) => {
        if (!user || !ADMIN_UIDS.includes(user.uid)) {
            window.location.href = './index.html';
            return;
        }

        iniciarPanelAdmin();
    });
});

// Mostrar/ocultar navbar
document.getElementById("toggleNav").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("hidden");
});

// Botón de cerrar sesión
const logoutSidebar = document.getElementById('logoutSidebar');
if (logoutSidebar) {
    logoutSidebar.addEventListener('click', async (e) => {
        e.preventDefault();
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
};

// Botón de cerrar popup
document.getElementById("cerrarPopupBtn").addEventListener("click", cerrarPopup);

// Función para iniciar el panel con FullCalendar
function iniciarPanelAdmin() {
    const calendarEl = document.getElementById('calendar-admin');

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
                const reservationsByDate = {};

                querySnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const date = data.date;
                    const name = data.nombre || "Desconocido";

                    if (date) {
                        if (!reservationsByDate[date]) {
                            reservationsByDate[date] = [];
                        }
                        reservationsByDate[date].push(name);
                    }
                });

                const events = Object.keys(reservationsByDate).map(date => ({
                    title: `${reservationsByDate[date].length}`,
                    start: date,
                    allDay: true,
                    extendedProps: {
                        names: reservationsByDate[date]
                    }
                }));

                successCallback(events);
            }, (error) => {
                console.error('Error al obtener las reservas:', error);
                failureCallback(error);
            });
        },
        eventClick: async function (info) {
            const date = info.event.startStr;
            console.log("Fecha seleccionada:", date);  // Verifica que la fecha sea la correcta
            const reservas = await getReservasPorDia(date);
            console.log("Reservas encontradas:", reservas); // 🔍 Agrega esto

            if (reservas.length > 0) {
                abrirPopupAsistencia(reservas, date);
            }else {
        console.log("No se encontraron reservas para esa fecha");
            }
        },
        eventMouseEnter: function (info) {
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.innerHTML = `<strong>Usuarios:</strong><br>${info.event.extendedProps.names.join('<br>')}`;
            document.body.appendChild(tooltip);

            function positionTooltip(e) {
                tooltip.style.left = `${e.pageX + 10}px`;
                tooltip.style.top = `${e.pageY + 10}px`;
            }

            positionTooltip(info.jsEvent);

            info.el.addEventListener('mousemove', positionTooltip);
            info.el.addEventListener('mouseleave', () => tooltip.remove());
        },
        dayCellClassNames: function (arg) {
            const day = arg.date.getDay();
            if (day !== 5 && day !== 6) {
                return ['disabled-day'];
            }
        }
    });

    calendar.render();
}

// Obtener reservas desde Firestore
async function getReservasPorDia(dayString) {
    console.log("Buscando reservas en:", `asistencias/${dayString}/usuarios`);

    const reservas = [];
    const snapshot = await getDocs(collection(db, "asistencias", dayString, "usuarios"));

    if (snapshot.empty) {
        console.log("No se encontró ningún documento en la subcolección.");
    } else {
        console.log(`Se encontraron ${snapshot.size} documentos`);
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Documento encontrado:", doc.id, data);
        reservas.push({
            uid: doc.id,
            nombre: data.nombre,
            presente: data.presente || false
        });
    });
    return reservas;
}

// Mostrar pop-up de asistencia
function abrirPopupAsistencia(reservas, dayString) {
    const popup = document.getElementById("asistenciaPopup");
    const listaUsuarios = document.getElementById("listaUsuarios");
    const fechaReserva = document.getElementById("fechaReserva");

    console.log("Mostrando popup con:", reservas); // Agrega este log

    listaUsuarios.innerHTML = "";
    fechaReserva.textContent = dayString;

    reservas.forEach((usuario) => {
        const li = document.createElement("li");
        li.classList.add("asistencia-item");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = usuario.presente;
        checkbox.id = usuario.uid;
        checkbox.addEventListener("change", () => {
            guardarAsistencia(dayString, usuario.uid, checkbox.checked);
        });

        const nombre = document.createElement("span");
        nombre.textContent = usuario.nombre;

        li.appendChild(checkbox);
        li.appendChild(nombre);
        listaUsuarios.appendChild(li);
    });

    // Añadir la clase active al pop-up para mostrarlo
    popup.classList.add("active");
}


// Guardar asistencia en Firestore
async function guardarAsistencia(dayString, uid, presente) {
    try {
        const ref = doc(db, "asistencias", dayString, "usuarios", uid);
        await updateDoc(ref, { presente });
        showAlert("Asistencia actualizada", "success");
    } catch (error) {
        console.error("Error al guardar asistencia:", error);
        showAlert("Error al guardar asistencia", "error");
    }
}

// Cerrar pop-up
function cerrarPopup() {
    const popup = document.getElementById("asistenciaPopup");
    popup.classList.remove("active"); // Remover la clase para cerrar el pop-up
}
