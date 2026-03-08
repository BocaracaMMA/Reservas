# Asistencias

## Objetivo

El módulo de asistencias registra la presencia real de alumnos en las clases y sirve como base para reportes y seguimiento operativo.

## Archivos principales

- `admin-asistencias.html`
- `marcar-asistencia.html`
- `js/admin-asistencias.js`
- `js/marcar-asistencia.js`
- `js/scan-asistencia.js`

## Formas de registrar asistencia

El sistema puede manejar distintos flujos según la pantalla usada:

- marcado manual por administración
- marcado desde vistas operativas
- escaneo o lectura rápida cuando aplique
- confirmación por usuario en ciertas variantes controladas

## Estructura de almacenamiento

Una estructura común en el proyecto es:

- `asistencias/{fecha}/usuarios/{uid}`

donde cada registro puede contener información como:

- `nombre`
- `hora`
- `presente`
- datos adicionales según el flujo

## Importancia funcional

La asistencia no es lo mismo que la reserva.

### Reserva
Indica intención o cupo asignado para una clase.

### Asistencia
Indica presencia real registrada en la operación.

## Relación con reportes

Los reportes administrativos dependen directamente de esta información. Por eso cualquier cambio en la forma de guardar asistencias debe reflejarse también en:

- `admin-reportes.js`
- `descargar-reportes.js`

## Riesgos comunes

- cambiar la ruta de guardado sin actualizar reportes
- guardar formatos inconsistentes de fecha
- mezclar datos de asistencia con lógica de reserva
- perder compatibilidad entre marcado manual y exportación

## Buenas prácticas

- mantener estructura estable por fecha
- usar formato consistente `YYYY-MM-DD`
- asegurar que el campo `presente` sea claro y usable
- validar bien ownership o permisos cuando aplica
- documentar cualquier variante adicional como `clases` si se introduce

## Casos de uso típicos

- confirmar asistencia de la clase del día
- llevar control de alumnos presentes
- alimentar reportes mensuales
- detectar participación real de usuarios

## Recomendaciones futuras

- dejar más clara la diferencia entre presente, ausente y no marcado
- agregar metadatos si luego se requiere análisis más profundo
- mantener parser centralizado para exportación

## Resumen

El módulo de asistencias registra la participación real del alumno y es la fuente de verdad para el sistema de reportes.
