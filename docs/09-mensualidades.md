# Mensualidades

## Objetivo

Este módulo controla el estado de pago del alumno, su autorización para usar el sistema y el envío de comprobantes.

## Archivos principales

- `admin-mensualidades.html`
- `js/admin-mensualidades.js`
- `client-pagos.html`
- `js/client-pagos.js`
- `js/login.js`

## Vista administrativa

Desde el panel administrativo se puede:

- ver usuarios y su estado
- consultar fecha de vencimiento
- determinar si están autorizados o no
- registrar un pago de mensualidad
- anular una mensualidad
- actualizar el mes pagado
- gestionar visibilidad de estados operativos

## Campos funcionales importantes

En `users`, algunos campos relevantes para este módulo son:

- `autorizado`
- `expiryDate`
- `lastPaymentAt`
- `cancelledAt`
- datos de membresía o plan

## Estados típicos

El sistema maneja estados funcionales como:

- activo
- próxima a vencer
- vencida
- oculto o no visible según reglas auxiliares

## Registro de pago desde admin

Cuando administración registra una mensualidad:

- se define un mes pagado
- se calcula la fecha de expiración
- se actualiza `expiryDate`
- el sistema decide si el usuario queda autorizado

## Anulación

La acción de anular debe:

- desautorizar al usuario
- conservar historial operativo razonable
- no romper trazabilidad

La implementación actual puede registrar marcas como `cancelledAt`.

## Flujo de cliente para pagos

La página `client-pagos.html` permite al usuario:

- enviar comprobantes
- indicar método de pago
- indicar monto
- indicar el mes pagado
- o indicar otro detalle si no es membresía
- subir imagen del comprobante
- abrir WhatsApp con mensaje prellenado

## Tipos de pago

El flujo actual soporta:

- `PAGO MEMBRESIA`
- `OTRO`

Esto permite usar el mismo módulo para mensualidades y cobros alternos como productos o servicios adicionales.

## Colección de pagos

La colección `payments` registra la evidencia del pago.

Datos funcionales relevantes:

- `uid`
- nombre
- cédula
- método
- monto
- `mes` o `mesPagado` cuando aplica
- `paymentType`
- `detallePago`
- `filePath`
- `fileURL`
- estado
- timestamp de creación

## Bloqueo por vencimiento en login

Cuando un usuario cliente intenta entrar y su mensualidad está vencida:

- no debe acceder al dashboard
- se le muestra el modal de bloqueo
- puede cargar el comprobante desde el mismo login
- el sistema mantiene el control operativo sin perder el flujo de pago

## Validación y seguridad

### Firestore
Las reglas deben validar correctamente:

- creación de pagos por el propio usuario autenticado
- formato de mes cuando sea pago de membresía
- presencia de `detallePago` cuando sea tipo `otro`

### Storage
Solo el usuario dueño o admin autorizado debe poder leer/escribir comprobantes según las reglas definidas.

## Buenas prácticas futuras

- unificar mejor la fuente de verdad para monto de membresía
- reforzar guard de vencimiento en todas las páginas del cliente
- documentar claramente diferencias entre “autenticado” y “autorizado”
- ampliar trazabilidad del historial de pagos si se requiere auditoría

## Resumen

El módulo de mensualidades controla si el alumno puede usar el sistema y ofrece el flujo para reportar pagos, mantener comprobantes y sostener el control operativo desde administración.
