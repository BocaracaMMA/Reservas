# Arquitectura general

## Visión general

Bocaraca Reservas es una aplicación web estática que usa Firebase como backend. La lógica principal vive en archivos JavaScript modulares y la interfaz se distribuye en múltiples páginas HTML según el rol y el flujo operativo.

## Capas del sistema

### 1. Frontend

La interfaz está construida con:

- HTML por página o módulo
- CSS global en `css/style.css`
- JavaScript modular en `js/`

No se usa framework de frontend como React, Vue o Angular. Esto simplifica el despliegue en GitHub Pages y reduce complejidad operativa.

### 2. Autenticación

La autenticación se maneja con **Firebase Authentication**.

Responsabilidades principales:

- login de usuarios
- registro
- cambio o recuperación de acceso
- validación de sesión
- diferenciación entre admin y cliente

### 3. Base de datos

La persistencia principal se maneja con **Cloud Firestore**.

Colecciones relevantes del sistema:

- `users`
- `reservations`
- `classSchedule`
- `asistencias`
- `payments`
- `events`
- `calendarExceptions`
- `notifications`
- `cedula_index`

### 4. Archivos

Los comprobantes y otros archivos subidos por usuario se almacenan en **Firebase Storage**.

Ejemplo de estructura:

- `payments/{uid}/...`

### 5. PWA

El sistema incluye:

- `manifest.webmanifest`
- `service-worker.js`
- lógica de registro de service worker
- comportamiento orientado a instalación como app

## Organización de páginas

El sistema separa flujos por tipo de usuario.

### Páginas públicas o de acceso

- `index.html`
- `register.html`
- `change-password.html`

### Páginas administrativas

- `admin-dashboard.html`
- `admin-usuarios.html`
- `admin-roles.html`
- `admin-mensualidades.html`
- `admin-reportes.html`
- `admin-calendario.html`
- `admin-metrics.html`

### Páginas de cliente

- `client-dashboard.html`
- `client-profile.html`
- `client-pagos.html`

## Organización de scripts

La carpeta `js/` concentra la mayor parte de la lógica.

Archivos clave:

- `firebase-config.js`: inicialización y conexión a Firebase
- `login.js`: autenticación
- `role-guard.js`: control de acceso por rol
- `visibility-rules.js`: helpers de visibilidad y validaciones operativas
- `client.js`: lógica principal del panel cliente
- `admin-calendario.js`: configuración del horario
- `admin-mensualidades.js`: control de vencimientos y autorización
- `admin-reportes.js`: lectura y visualización de asistencias
- `descargar-reportes.js`: exportación a Excel

## Patrón general de funcionamiento

El flujo más común del sistema es:

1. el usuario inicia sesión
2. se valida sesión, rol y estado operativo
3. se redirige a dashboard administrativo o cliente
4. desde ahí se accede a módulos especializados
5. cada módulo consulta o actualiza datos en Firestore
6. ciertos flujos también usan Firebase Storage

## Decisiones técnicas importantes

### Frontend estático
Permite publicar en GitHub Pages sin backend propio.

### Firebase como backend
Reduce infraestructura y centraliza autenticación, base de datos y archivos.

### Múltiples páginas HTML
Facilita separar flujos administrativos y de cliente sin introducir una SPA compleja.

### Diseño mobile-first
La experiencia en celular y PWA es prioritaria porque gran parte del uso operativo ocurre desde móviles.

## Riesgos o puntos sensibles

- lógica distribuida entre varias páginas
- dependencia fuerte de la estructura real de Firestore
- reglas de seguridad críticas para evitar accesos indebidos
- necesidad de mantener consistencia entre UI, lógica y reglas

## Resumen

La arquitectura de Bocaraca Reservas está diseñada para ser:

- simple de desplegar
- funcional en móvil
- fácil de mantener por módulos
- dependiente de Firebase como núcleo operativo
