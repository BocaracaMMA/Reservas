# Firebase y seguridad

## Objetivo

Este documento resume cómo Bocaraca Reservas usa Firebase y cuáles son los puntos más importantes de seguridad y control de acceso.

## Servicios Firebase utilizados

### Firebase Authentication
Se usa para:

- iniciar sesión
- registrar usuarios
- mantener sesiones activas
- identificar al usuario autenticado

### Cloud Firestore
Se usa para almacenar la información operativa del sistema.

Colecciones relevantes:

- `users`
- `cedula_index`
- `reservations`
- `classSchedule`
- `asistencias`
- `payments`
- `events`
- `calendarExceptions`
- `notifications`

### Firebase Storage
Se usa principalmente para archivos cargados por usuarios, como comprobantes de pago.

## Colección `users`

Es la base para resolver:

- identidad funcional
- roles
- estado de autorización
- vencimiento de mensualidad
- datos del alumno o usuario administrativo

Campos usados por distintos módulos:

- `nombre`
- `correo`
- `cedula`
- `roles`
- `autorizado`
- `expiryDate`
- datos de membresía
- timestamps operativos

## Roles

El sistema utiliza validaciones por rol como:

- `admin`
- `professor`
- `dev`

Estos roles se consultan tanto desde frontend como desde reglas de Firestore.

## Seguridad real

## Importante

Ocultar botones o páginas en frontend **no es seguridad real**.

La seguridad real depende de:

- reglas de Firestore
- reglas de Storage
- validación de sesión y rol
- validación de ownership o pertenencia del dato

## Firestore

Las reglas deben cubrir correctamente estos escenarios:

### Usuarios
- el usuario puede leer o actualizar solo su propio perfil cuando corresponda
- admin/dev pueden leer o administrar más ampliamente

### Reservas
- el usuario solo debe crear reservas para sí mismo
- no debe manipular reservas ajenas
- admin/dev pueden tener permisos ampliados

### Asistencias
- el sistema debe permitir flujos administrativos y, cuando aplique, el flujo del propio usuario según la lógica definida

### Pagos
- el usuario autenticado puede registrar sus propios comprobantes
- admin/dev pueden leer o gestionar pagos según necesidad operativa

### Excepciones de calendario y horario
- solo admin/dev deberían modificar calendario base o excepciones

## Storage

La ruta de comprobantes normalmente sigue este patrón:

- `payments/{uid}/...`

Las reglas deben asegurar que:

- el usuario solo escriba en su espacio
- solo admin o el propio usuario puedan leer según lo definido
- el archivo cumpla restricciones de tamaño y tipo

## Buenas prácticas aplicadas o recomendadas

- usar `request.auth != null` como base mínima
- validar `request.auth.uid`
- validar rol desde el documento de usuario
- validar formatos cuando aplique, como `YYYY-MM`
- restringir lectura y escritura por colección
- no confiar solo en frontend para reglas de negocio críticas

## Riesgos comunes

- reglas demasiado amplias
- cambios en estructura de datos sin actualizar reglas
- frontend permitiendo acciones que luego Firestore rechaza
- dependencia de campos inconsistentes en `users`

## Recomendaciones de mantenimiento

- revisar reglas cada vez que se agregue una colección nueva
- documentar cambios en permisos
- mantener alineación entre frontend y reglas
- probar siempre con cuenta admin y cuenta cliente
- validar pagos, reservas y asistencias después de cambios sensibles

## Resumen

Firebase es el backend central del sistema y su seguridad depende de la combinación correcta de:

- autenticación
- reglas de Firestore
- reglas de Storage
- validaciones de frontend
- estructura coherente de datos
