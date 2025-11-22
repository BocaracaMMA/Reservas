# Bocaraca Reservas 🐍🥋

Sistema web para academias de artes marciales (actualmente en producción en **Bocaraca MMA**) que gestiona:

- Alumnos y perfiles
- Mensualidades y pagos
- Reservas de clases por horario
- Asistencias (manuales y por QR)
- Reportes y exportación a Excel
- Panel de alumno y panel administrativo

Está pensado para funcionar bien en **móvil**, como **PWA**, y usando únicamente **Firebase (Firestore + Auth)** como backend.

---

## 1. Qué problema resuelve

En la mayoría de academias, la información está repartida entre hojas de cálculo, WhatsApp y papel.  
**Bocaraca Reservas** centraliza todo en un solo lugar:

- Control de alumnos y sus datos.
- Seguimiento de mensualidades pagadas / pendientes.
- Registro de asistencia y reservas por clase.
- Reportes descargables para revisión interna o contabilidad.

---

## 2. Roles y tipos de usuario

Los permisos están basados en un campo `roles` dentro de cada documento de `users/{uid}` en Firestore.  
Las reglas de seguridad utilizan funciones como `isAdmin`, `isProfessor` e `isDev` para controlar el acceso.

### 2.1 Dev

- Pensado para el dueño del sistema / desarrollador.
- Tiene todos los permisos de un admin, más tareas técnicas y pruebas.
- En las reglas se usa como parte del helper `isAdminOrDev()` para todo lo que sea “de administración fuerte”.

### 2.2 Admin

- Responsable del funcionamiento del sistema en el gym.
- Accede al panel `admin-dashboard.html`.
- Puede:
  - Crear/editar/bloquear usuarios.
  - Aprobar solicitudes de registro.
  - Gestionar mensualidades y pagos.
  - Configurar el calendario de clases (`admin-calendario.html`).
  - Ver y marcar asistencias.
  - Generar reportes y exportarlos a Excel.

### 2.3 Profesor / Staff

- Tiene acceso a las herramientas necesarias para **marcar asistencia** y ver el calendario.
- Usa el mismo panel base de admin, pero con permisos restringidos según las reglas de Firestore.

### 2.4 Alumno

- Se registra en `register.html` y luego inicia sesión en `index.html`.
- Accede al panel de cliente `client-dashboard.html`, donde puede:
  - Ver su estado general.
  - Reservar clases en el calendario.
  - Consultar asistencias y otra información relevante.

---

## 3. Flujo general de uso

### 3.1 Registro del alumno

1. Completa el formulario en `register.html` con:
   - Nombre, apellidos, tipo de identificación (CR / extranjera),
   - Cédula o ID externo, teléfono, género, fecha de nacimiento,
   - Email construido con un selector de dominios seguros, contraseña, etc.
2. Se valida la información (formato de nombre, cédula, teléfono, email y password) y se crean:
   - El usuario en Firebase Auth.
   - El documento de perfil en Firestore, con rol inicial `["student"]` y campos como:
     - `autorizado`, `banned`, `genero`, `birthDate`, `attendanceCode`, etc.

### 3.2 Aprobación de registro

- Las solicitudes se revisan en el panel de administración (`admin-usuarios.html`), donde el staff puede **aceptar o rechazar** usando un modal consistente con el resto de la interfaz.
- Al aceptar:
  - Se asignan roles (por defecto, `student`, opcionalmente `professor`, `admin`, `dev`).
  - Se marca el usuario como autorizado para poder reservar.

### 3.3 Inicio de sesión

- El usuario entra por `index.html` (pantalla de login, también con pestaña de precios / info comercial).
- Si es alumno, va a `client-dashboard.html`.
- Si tiene rol de staff/admin/dev, accede al panel administrativo.

---

## 4. Módulos principales

### 4.1 Panel administrativo

Desde el dashboard se accede, mediante el sidebar, a:

- **Usuarios (`usuarios.html`)**  
  Alta, baja y modificación de perfiles. Gestión de roles y aprobación de registros.

- **Mensualidades (`control-mensualidades.html`)**  
  Registro de pagos, actualización de estados y consulta de histórico.

- **Asistencias (`marcar-asistencia.html`)**  
  Vista para marcar presencia del día, compatible con QR.

- **Reportes (`reportes.html`)**  
  Reportes mensuales y exportación avanzada a Excel.

- **Configuración de horarios (`admin-calendario.html`)**  
  Donde se definen los bloques de clase recurrentes, con:
  - Día de la semana
  - Hora de inicio y fin
  - Profesor
  - Tipo de clase (con paleta de colores)
  - Capacidad mínima y máxima
  - Marcado como “permanente” o no.

### 4.2 Panel del alumno (`client-dashboard.html`)

- Calendario mensual (FullCalendar) con vista de las reservas del alumno.
- Posibilidad de **reservar clase haciendo click en un día** y seleccionando un horario disponible.
- Cancelación de reservas dentro de los límites permitidos (no se puede cancelar durante o después de la clase).
- Código de asistencia personal visible en el panel.
- Modal de escáner QR para marcar asistencia desde el celular.

---

## 5. Reservas de clases y asistencias

### 5.1 Calendario del alumno

- Muestra un calendario mensual con:
  - Días con clases configuradas (según `classSchedule`).
  - Días sin clases, deshabilitados visualmente.
- Cada reserva se representa como un evento con un icono ✅.

Al hacer click en un día:

- Se validan reglas de negocio:
  - Solo se puede reservar en el **mes actual**.
  - Solo se permiten reservas **hasta una hora antes** de la clase.
- Se abre un modal de **“Clases disponibles”** con tarjetas por horario:
  - Rango de horas (9:00 am – 10:00 am).
  - Tipo de clase (por ejemplo “MMA Adultos”).
  - Profesor.
  - Cupos reservados, libres y estado de la clase (pendiente o confirmada según `minCapacity`).

Los cupos se calculan combinando:

- Reservas nuevas de la colección `reservations`.
- Asistencias antiguas de `asistencias/{fecha}/usuarios` (para ser compatible con datos históricos).

### 5.2 Reglas de reserva

- Un usuario no puede crear dos reservas para el mismo horario.
- Se impide reservar si el horario ya alcanzó `maxCapacity`.
- El sistema utiliza timestamps (`slotTs`) en CR (`America/Costa_Rica`) para validar:
  - Reserva con al menos una hora de anticipación.
  - Prohibir cancelaciones durante o después de la clase.

### 5.3 Calendario del staff / asistencia

- El calendario de staff agrupa reservas por día:
  - Cada día muestra el número total de reservas.
  - Al hacer click, se abre un popup de asistencia con los alumnos agrupados por horario.
- En el popup, el profesor puede marcar `presente` con un checkbox; se guarda en `asistencias/{fecha}/usuarios/{uid_hora}`.

---

## 6. Reportes y exportación a Excel

La página `reportes.html` fue rediseñada para encajar mejor con la estética actual y ofrecer más control sobre los datos exportados.

### 6.1 Filtros de período

- Selección de **año** y **mes** en una card superior (“Filtros de período”).
- Botón verde “Ver reporte” centrado, que carga:
  - Resumen diario del mes seleccionado.
  - Tabla de asistencias agrupada por día.

### 6.2 Configuración de exportación

En la card “Exportar a Excel” se puede elegir:

- **Alcance**
  - Mes seleccionado.
  - Todo el histórico.

- **Tipo de reporte**
  - **Detallado**: una fila por asistencia.
  - **Resumen por alumno**: totales, presentes, ausentes y porcentaje de asistencia.

- **Columnas (modo detallado)**
  - Fecha, nombre, hora, presente, tipo de clase, profesor, etc.
  - Se pueden activar/desactivar con checkboxes estilo “pill”.

### 6.3 Generación del Excel

El archivo `descargar-reportes.js`:

- Llama a Firestore para leer `asistencias/{fecha}/usuarios` según el alcance seleccionado.
- Construye:
  - Hoja **Detalle** (según columnas elegidas).
  - Hoja **Resumen** por alumno (si se selecciona ese modo).
- Genera un archivo `.xlsx` con un nombre descriptivo, por ejemplo:
  - `reporte_asistencia_detalle_2025-11.xlsx`
  - `reporte_asistencia_resumen_historico.xlsx`
- Muestra un mensaje con `showAlert` al terminar o en caso de error.

### 6.4 Vista previa del Excel

Debajo de los filtros se añadió una card **“Vista previa del Excel”**:

- Cuando se descarga el reporte, primero se genera una **tabla HTML** con los mismos datos que irán al Excel (detalle o resumen, según la selección).
- La tabla:
  - Tiene scroll **horizontal** para manejar muchas columnas.
  - Está contenida en un área con altura máxima y **scroll vertical**, para que no se haga infinita hacia abajo.
  - Usa la misma paleta oscura del sistema para integrarse visualmente con las demás tablas (usuarios, mensualidades, etc.).

---

## 7. PWA y manejo de versiones

El proyecto incluye un **service worker** (`service-worker.js`) y archivos relacionados (`manifest.webmanifest`, `offline.html`) para comportarse como PWA.

- La versión actual de la app se controla con la constante:

  ```js
  const APP_VERSION = '2025.11.19.v1';
  const CACHE_NAME  = `app-${APP_VERSION}`;
  ```

- El service worker:
  - Cachea los recursos estáticos JS/CSS/imagenes.
  - Limpia versiones anteriores en el evento `activate`.
  - Soporta mensajes como `SKIP_WAITING` y `CLEAR_ALL_CACHES` para que la app pueda forzar una actualización desde la UI.

En la pantalla de login se muestra la **versión en producción**, tomada del service worker mediante `sw-register.js`, para saber fácilmente qué build está desplegada.

---

## 8. Arquitectura técnica (resumen)

- **Frontend 100% estático**:
  - HTML + CSS + JavaScript.
  - Varias páginas según módulo (`index.html`, `register.html`, `admin-dashboard.html`, `client-dashboard.html`, `reportes.html`, etc.).
- **Backend-as-a-service con Firebase**:
  - Firestore para datos (colecciones: `users`, `classSchedule`, `reservations`, `asistencias`, `payments`, `calendarExceptions`, etc.).
  - Firebase Auth para login por email/contraseña.
- **PWA**:
  - `service-worker.js` y `manifest.webmanifest` permiten instalación como app y manejo de offline básico.
- **UI**:
  - FullCalendar para calendarios de administración y alumno.
  - Estilo pensado primero para móvil (Android/iOS), con tarjetas, botones grandes y scroll suave.

---

## 9. Seguridad y privacidad

Aunque el detalle exacto está en las reglas de Firestore:

- Todas las operaciones requieren autenticación (`request.auth != null`).
- Cada operación verifica el rol adecuado (admin, professor, dev, student).
- Los alumnos solo pueden ver y modificar sus propios datos y reservas.
- Admin y Dev tienen permisos ampliados para gestión y reportes.
- La app se ejecuta sobre la infraestructura de Firebase/Google, aprovechando su seguridad y alta disponibilidad.

---

## 10. Requisitos para usar el sistema

Para usar Bocaraca Reservas en otro gym se necesita:

1. **Proyecto de Firebase** con:
   - Firestore habilitado.
   - Autenticación por email/contraseña.
2. Configurar las credenciales de Firebase en `firebase-config.js`.
3. Desplegar los archivos estáticos:
   - Firebase Hosting **o**
   - GitHub Pages / hosting estático similar.
4. Usar un navegador moderno (Chrome, Edge, Firefox, Safari).

---

## 11. En una frase

> **Bocaraca Reservas** es un sistema web para academias que centraliza alumnos, pagos, reservas y asistencias en un solo lugar, con reportes listos para Excel y funcionamiento optimizado para móviles.

---

## 12. Ideas futuras

- Integrar pasarelas de pago en línea.
- Recordatorios automáticos (correo/WhatsApp) de vencimiento de mensualidades.
- Métricas visuales avanzadas (gráficos en un panel de métricas).
- Empaquetar la PWA como app nativa para Android/iOS.
