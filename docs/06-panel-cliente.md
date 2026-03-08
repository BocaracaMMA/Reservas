# Panel cliente

## Objetivo

El panel cliente ofrece al alumno o usuario final una vista simple y enfocada en sus necesidades operativas: ver clases, reservar, revisar su información y reportar pagos.

## Páginas principales

Las vistas cliente incluyen al menos:

- `client-dashboard.html`
- `client-profile.html`
- `client-pagos.html`

## Acceso

Para usar el panel cliente se requiere:

- usuario autenticado
- datos válidos en `users`
- autorización operativa según mensualidad
- guard de acceso correcto

## Funciones principales

### Dashboard del cliente

Es la vista principal del alumno. Desde aquí puede:

- ver disponibilidad de clases
- consultar calendario
- revisar horarios
- reservar espacios disponibles

### Perfil

La página de perfil permite visualizar y, según la implementación, actualizar información personal relevante.

### Pagos

La página de pagos permite:

- enviar comprobantes
- indicar método de pago
- registrar monto
- reportar pago de membresía
- reportar otros pagos
- abrir WhatsApp con mensaje prellenado

## Restricción por mensualidad vencida

Uno de los comportamientos más importantes del panel cliente es que el usuario no debe operar normalmente si está vencido.

En la versión actual del flujo:

- puede autenticarse
- no se le permite entrar normalmente al sistema si está vencido
- se muestra un modal de bloqueo
- puede reportar el comprobante desde el login

## Reservas

El panel cliente consume el calendario operativo y permite realizar reservas con validaciones como:

- cupo disponible
- horario válido
- clase futura
- ownership correcto

## Experiencia móvil

El panel cliente está diseñado con prioridad para:

- celulares Android
- iPhone
- modo PWA
- navegación táctil simple

## Riesgos comunes

- permitir acceso cliente a páginas admin
- no aplicar el guard de vencimiento en vistas sensibles
- romper experiencia móvil por cambios solo pensados para desktop
- perder consistencia entre el estado del usuario y la UI

## Buenas prácticas futuras

- mantener acciones primarias grandes y claras
- reforzar validación de vencimiento en todas las páginas cliente
- simplificar formularios para móvil
- mantener consistencia entre calendario, reservas y pagos

## Resumen

El panel cliente está pensado para ser rápido, claro y usable desde el celular, con foco en reservas, perfil y comprobantes.
