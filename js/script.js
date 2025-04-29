// Mostrar alertas tipo toast
function showAlert(message, type = 'success') {
    let container = document.getElementById('toast-container');

    // Si no existe el contenedor, lo creamos
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Eliminar el toast después de 4 segundos (coincide con tu animación fadeInOut)
    setTimeout(() => {
        toast.remove();
    }, 4000);
}


// LOGIN
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // Simulación de login
        if (email === "admin@mma.com" && password === "admin123") {
            showAlert('Login exitoso como administrador!', 'success');
            setTimeout(() => {
                window.location.href = './admin-dashboard.html';
            }, 1000);
        } else if (email && password) {
            showAlert('Login exitoso como cliente!', 'success');
            setTimeout(() => {
                window.location.href = './client-dashboard.html';
            }, 1000);
        } else {
            showAlert('Email o contraseña incorrectos.', 'error');
        }
    });
}

// REGISTRO
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const fullName = document.getElementById("fullName").value;
        const phone = document.getElementById("phone").value;
        const cedula = document.getElementById("cedula").value;

        // Simulación de registro exitoso
        if (email && password && fullName && phone && cedula) {
            showAlert('Registro exitoso!', 'success');
            setTimeout(() => {
                window.location.href = './index.html';
            }, 1000);
        } else {
            showAlert('Por favor completa todos los campos.', 'error');
        }
    });
}

// RESERVAR CLASE
const reserveButton = document.getElementById("reserve-button");
if (reserveButton) {
    reserveButton.addEventListener("click", async () => {
        const selectedDate = "2025-05-03"; // Fecha ejemplo
        // Simular reserva exitosa
        showAlert(`Clase reservada para el ${selectedDate}`, 'success');
    });
}

// LOGOUT
const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        showAlert('Sesión cerrada.', 'success');
        setTimeout(() => {
            window.location.href = './index.html';
        }, 1000);
    });
}
