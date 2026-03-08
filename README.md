# Bocaraca Reservas 🐍🥋

Sistema web para academias de artes marciales, actualmente en producción en **Bocaraca MMA**, enfocado en la gestión operativa diaria desde celular, escritorio y modo **PWA**.

Gestiona en un solo sistema:

- Alumnos y perfiles
- Mensualidades y pagos
- Reservas por horario
- Asistencias manuales y por QR
- Reportes con exportación avanzada a Excel
- Panel administrativo y panel del alumno
- Configuración de calendario semanal y días especiales

Está construido con:

- **HTML + CSS + JavaScript vanilla**
- **Firebase Authentication**
- **Cloud Firestore**
- **Firebase Storage**
- **GitHub Pages / hosting estático**
- **PWA** para mejor experiencia en móvil

---

## 1. Qué problema resuelve

En muchas academias, la operación diaria termina dividida entre hojas de cálculo, mensajes por WhatsApp, notas manuales y seguimiento informal.

**Bocaraca Reservas** centraliza esos procesos en un solo lugar:

- gestión de alumnos y perfiles
- control de mensualidades y vencimientos
- reservas de clases por horario
- asistencia diaria
- reportes administrativos
- envío de comprobantes de pago
- configuración del calendario de clases

---

## 2. Roles y tipos de usuario

Los permisos del sistema se resuelven desde el documento del usuario en Firestore, usando un campo `roles` y reglas de seguridad por rol.

### 2.1 Dev

- Rol del propietario técnico o desarrollador.
- Tiene permisos administrativos ampliados.
- Se usa como parte de los helpers de administración fuerte.

### 2.2 Admin

- Responsable del manejo operativo del sistema.
- Accede al panel administrativo.
- Puede:
  - gestionar usuarios
  - aprobar registros
  - administrar mensualidades
  - configurar el calendario
  - marcar asistencias
  - generar reportes
  - revisar pagos y comprobantes

### 2.3 Professor / Staff

- Tiene acceso a herramientas operativas como calendario y asistencias.
- Sus permisos son más limitados que los del admin.

### 2.4 Alumno

- Se registra desde `register.html`.
- Inicia sesión desde `index.html`.
- Accede a `client-dashboard.html` y módulos cliente.

---

## 3. Flujo general del sistema

### 3.1 Registro del alumno

El usuario completa su información en `register.html` y el sistema crea:

- la cuenta en Firebase Authentication
- el perfil en Firestore dentro de `users`

### 3.2 Aprobación de registro

Desde administración se revisan solicitudes y se decide si el usuario queda habilitado para usar el sistema.

### 3.3 Inicio de sesión

El acceso principal ocurre desde `index.html`, que también incluye una pestaña comercial con precios de membresías.

- si el usuario es staff/admin/dev, entra al panel administrativo
- si es alumno, entra al panel cliente

### 3.4 Bloqueo por mensualidad vencida

El sistema ahora contempla un flujo más estricto para usuarios cliente con mensualidad vencida:

- el usuario puede autenticarse
- pero no puede entrar al dashboard si está vencido o no autorizado
- se muestra un modal en login indicando:
  - tipo de membresía
  - monto
  - fecha de vencimiento
- desde ese mismo modal puede enviar el comprobante de pago

Este flujo evita acceso normal al sistema mientras la mensualidad siga vencida.

---

## 4. Módulos principales

### 4.1 Panel administrativo

Desde el panel de administración se accede a módulos como:

- usuarios
- roles
- mensualidades
- calendario
- asistencias
- reportes
- métricas

### 4.2 Panel del alumno

Desde `client-dashboard.html`, el alumno puede:

- revisar calendario
- reservar clases
- consultar datos relevantes
- ver su código de asistencia
- acceder al flujo de pagos

### 4.3 Calendario administrativo

El módulo `admin-calendario.html` permite:

- crear clases recurrentes
- editar bloques existentes
- definir profesor, hora, color y capacidad
- configurar días especiales
- bloquear días completos o crear horarios especiales por fecha

Además, el calendario administrativo fue ajustado visualmente para verse más limpio, moderno y cómodo en móvil/PWA.

### 4.4 Módulo de pagos del cliente

La página `client-pagos.html` ahora soporta dos tipos de envío:

- **PAGO MEMBRESIA**
- **OTRO**

Esto permite registrar pagos de mensualidad y también otros cobros, por ejemplo productos o artículos como camisas.

---

## 5. Reservas y asistencias

### 5.1 Reservas del alumno

El alumno puede reservar desde el calendario según:

- disponibilidad del horario
- reglas del mes actual
- anticipación mínima permitida
- cupo máximo
- restricciones del horario

### 5.2 Reglas operativas

Entre las reglas más importantes:

- no se puede reservar dos veces el mismo horario
- no se puede reservar si no hay cupo
- no se puede cancelar durante o después de la clase
- el sistema usa timestamps para controlar ventanas de tiempo

### 5.3 Asistencias

Las asistencias se registran en Firestore y luego alimentan los reportes administrativos.

Se soportan flujos como:

- marcado manual
- QR
- revisión administrativa

---

## 6. Mensualidades y pagos

### 6.1 Control administrativo

El módulo de mensualidades permite:

- ver quién está activo, próximo a vencer o vencido
- definir el mes pagado
- actualizar `expiryDate`
- autorizar o desautorizar reservas
- **anular** una mensualidad

La acción de anular deja el usuario sin autorización operativa y sirve para control más claro del estado real.

### 6.2 Flujo de comprobantes

Los comprobantes se cargan a Storage y se registran en Firestore. Luego se abre automáticamente WhatsApp con un mensaje prellenado para facilitar revisión por parte del negocio.

---

## 7. Reportes y exportación a Excel

El módulo de reportes fue mejorado a nivel funcional y visual.

### 7.1 Vista en pantalla

Actualmente ofrece:

- filtros por año y mes
- métricas rápidas
- agrupación por día
- detalle de asistencias por fecha
- vista más limpia y mobile-first

### 7.2 Exportación a Excel

El Excel fue mejorado para verse y sentirse más profesional.

Ahora puede incluir:

- hoja de detalle
- hoja de resumen
- hoja de información
- hoja de configuración
- filtros automáticos
- columnas ajustadas
- nombres de archivo más claros

### 7.3 Estructura real de lectura

El módulo ya no depende de que exista el documento padre de `asistencias/{fecha}` para mostrar resultados.

Ahora trabaja leyendo directamente los registros reales de asistencia, lo que hizo el reporte mucho más confiable con la estructura actual del sistema.

---

## 8. PWA y enfoque mobile-first

Bocaraca Reservas está pensado primero para **celular**.

Incluye:

- `manifest.webmanifest`
- `service-worker.js`
- instalación como app
- estrategia de caché para experiencia PWA

El diseño actual prioriza:

- pantallas pequeñas
- botones cómodos de tocar
- tarjetas legibles
- tablas con scroll controlado cuando hace falta
- uso real en Android/iPhone

---

## 9. Arquitectura técnica

### Frontend

- proyecto estático
- múltiples páginas HTML según módulo
- estilos globales en `css/style.css`
- lógica modular en `js/`

### Backend

Firebase concentra:

- autenticación
- base de datos
- archivos

### Colecciones principales

Entre las más importantes:

- `users`
- `classSchedule`
- `reservations`
- `asistencias`
- `payments`
- `calendarExceptions`
- `events`
- `notifications`

---

## 10. Documentación del proyecto

El repositorio ya incluye una carpeta `docs/` con documentación técnica base del sistema, organizada por módulos.

Ejemplos de documentos incluidos:

- arquitectura general
- autenticación y roles
- calendario y reservas
- mensualidades
- reportes
- Firebase y seguridad
- estructura de archivos
- troubleshooting

También se añadió configuración base para **MkDocs + Material** para poder convertir esa documentación en un sitio navegable más adelante.

---

## 11. Licencia y uso

Este proyecto es **software propietario**.

Todos los derechos sobre el código fuente, diseño, estructura, lógica de negocio, interfaz, documentación y archivos asociados pertenecen a **Luis David Solórzano Montero**, salvo que se indique lo contrario.

No está permitido:

- copiar
- clonar
- redistribuir
- sublicenciar
- modificar para uso no autorizado
- vender
- reutilizar total o parcialmente este proyecto

sin autorización previa y por escrito del propietario.

El acceso al repositorio o a una copia del proyecto **no implica cesión de derechos ni licencia de uso**, salvo autorización expresa del autor.

Para solicitar autorización de uso o licencia comercial, debe contactarse directamente al propietario.

---

## 12. Requisitos para usar el sistema

Para instalar o adaptar el sistema en otro entorno se requiere:

1. proyecto de Firebase configurado correctamente
2. Firestore habilitado
3. Authentication por email/contraseña
4. Storage habilitado
5. configuración correcta en `firebase-config.js`
6. hosting estático o despliegue equivalente

---

## 13. En una frase

> **Bocaraca Reservas** es un sistema web propietario para academias que centraliza alumnos, pagos, reservas, asistencias, calendario y reportes en una sola plataforma, optimizada para móvil y PWA.

---

## 14. Ideas futuras

- recordatorios automáticos de vencimiento
- más métricas visuales
- reportes por profesor o tipo de clase
- logs internos de errores
- documentación pública más completa
- formalización de licencias comerciales por cliente
