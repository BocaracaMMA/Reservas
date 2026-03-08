# Autenticación y roles

## Objetivo

Este módulo controla quién puede entrar al sistema, a qué panel se dirige cada usuario y qué permisos tiene dentro de la aplicación.

## Archivos principales

- `index.html`
- `register.html`
- `change-password.html`
- `js/login.js`
- `js/register.js`
- `js/role-guard.js`
- `js/firebase-config.js`

## Flujo de autenticación

### Inicio de sesión

El usuario entra desde `index.html`.

Flujo general:

1. ingresa correo y contraseña
2. `login.js` ejecuta autenticación con Firebase Auth
3. se consulta el documento del usuario en Firestore
4. se evalúa si es admin o cliente
5. se valida si puede ingresar o si debe ser bloqueado por vencimiento
6. se redirige al dashboard correspondiente

### Registro

El registro crea:

- usuario autenticado en Firebase Auth
- documento asociado en `users`
- validaciones adicionales como cédula y estructura de datos

### Recuperación o cambio

El flujo de recuperación/cambio de contraseña se maneja desde la página correspondiente y depende del mecanismo definido en Firebase/Auth y la lógica de la interfaz.

## Roles

El sistema contempla al menos estos roles en lógica y reglas:

- `admin`
- `professor`
- `dev`

Además, existen usuarios cliente sin privilegios administrativos.

## Documento de usuario

La colección `users` es clave para resolver acceso y estado operativo.

Campos relevantes usados en distintos flujos:

- `nombre`
- `correo`
- `cedula`
- `roles`
- `autorizado`
- `expiryDate`
- `membresia` o variantes equivalentes
- campos de visibilidad o control interno

## Control por rol

El sistema usa guards en frontend para restringir acceso a páginas administrativas.

Objetivo:

- un cliente no debe poder abrir vistas de admin
- un admin no debería depender solo de ocultar botones
- la seguridad real debe estar respaldada por reglas de Firestore/Storage

## Bloqueo por mensualidad vencida

Una parte importante del flujo actual es el bloqueo por vencimiento de mensualidad.

### Comportamiento esperado

Si un cliente inicia sesión y está vencido:

- no debe entrar al dashboard
- permanece en la pantalla de login
- se le muestra un modal de bloqueo
- se le informa el estado de su membresía
- puede subir comprobante y reportar el pago

### Motivo técnico

Se busca evitar que usuarios con mensualidad vencida usen el sistema normalmente, manteniendo al mismo tiempo la capacidad de enviar comprobante.

## Diferencia entre sesión activa y acceso permitido

Un usuario puede autenticarse técnicamente en Firebase, pero el sistema puede decidir no permitir el uso funcional de módulos si:

- está vencido
- no está autorizado
- no tiene el rol necesario

Esto es importante porque autenticación y autorización no son lo mismo.

## Consideraciones de seguridad

### En frontend
- ocultar botones no es suficiente
- siempre debe haber validación de acceso al cargar páginas sensibles

### En Firestore/Storage
- las reglas son la barrera real
- admin/dev deben tener acceso ampliado
- clientes deben quedar restringidos a sus propios datos cuando aplique

## Buenas prácticas futuras

- centralizar más validaciones de sesión
- aplicar el guard de vencimiento en todas las páginas cliente sensibles
- mantener consistencia entre datos de `users`, UI y reglas
- documentar claramente qué campo define autorización real

## Resumen

El módulo de autenticación y roles define:

- quién entra
- a qué panel entra
- qué puede hacer
- cuándo debe quedar bloqueado operativamente
