# Troubleshooting

## Objetivo

Este documento reúne problemas comunes del sistema y puntos básicos de revisión para diagnosticar fallos.

## 1. El login no redirige correctamente

### Posibles causas
- error en Firebase Auth
- documento de usuario inexistente o incompleto en `users`
- validación de rol incorrecta
- bloqueo por mensualidad vencida
- guard de página mal aplicado

### Revisar
- `js/login.js`
- `js/role-guard.js`
- datos del usuario en Firestore

## 2. El usuario inicia sesión pero no puede usar el sistema

### Posibles causas
- `autorizado: false`
- `expiryDate` vencida
- lógica de bloqueo por mensualidad
- reglas de Firestore impidiendo lecturas o escrituras

### Revisar
- documento del usuario en `users`
- `js/login.js`
- `js/admin-mensualidades.js`
- reglas de Firestore

## 3. No aparecen clases en el calendario del cliente

### Posibles causas
- `classSchedule` sin datos
- excepciones de calendario bloqueando el día
- error de render o parseo de horarios
- problema en lógica de carga del calendario

### Revisar
- `js/client.js`
- `js/admin-calendario.js`
- colección `classSchedule`
- colección `calendarExceptions`

## 4. Las reservas fallan o no se guardan

### Posibles causas
- reglas de Firestore
- horario vencido o inválido
- cupo lleno
- estructura de datos inconsistente
- validación de `userId` o slot incorrecta

### Revisar
- colección `reservations`
- reglas de Firestore
- `js/client.js`
- formato de fecha y hora

## 5. La asistencia no aparece en reportes

### Posibles causas
- estructura de asistencia cambió
- reporte leyendo rutas viejas
- datos guardados en subcolecciones no consideradas
- mes o año incorrecto

### Revisar
- `js/admin-reportes.js`
- `js/descargar-reportes.js`
- estructura real de `asistencias`

## 6. El Excel se descarga vacío o con error

### Posibles causas
- no existen registros para el período
- parser de documentos no reconoce la ruta
- librería `xlsx` no cargó
- error en la construcción del workbook

### Revisar
- consola del navegador
- `js/descargar-reportes.js`
- carga del script `xlsx`
- datos reales en Firestore

## 7. No se puede subir comprobante

### Posibles causas
- usuario no autenticado
- reglas de Storage
- archivo demasiado grande
- tipo de archivo inválido
- error al guardar el documento en `payments`

### Revisar
- `js/client-pagos.js`
- `js/login.js`
- reglas de Storage
- reglas de Firestore para `payments`

## 8. La mensualidad se ve mal o no autoriza al usuario

### Posibles causas
- `expiryDate` calculada incorrectamente
- lógica de mes actual / próximo mes
- falta de coherencia entre `autorizado` y fecha
- monto o membresía mal resueltos en UI

### Revisar
- `js/admin-mensualidades.js`
- `js/login.js`
- documento del usuario en `users`

## 9. El calendario admin se ve roto en móvil

### Posibles causas
- CSS no actualizado
- conflictos globales en `style.css`
- toolbar de FullCalendar sin ajustes responsive
- contenedor con ancho insuficiente

### Revisar
- `admin-calendario.html`
- bloque CSS del módulo calendario admin
- comportamiento en PWA real

## 10. Cambios no se reflejan después de deploy

### Posibles causas
- service worker con caché vieja
- navegador usando archivos en caché
- manifest o SW no actualizados
- GitHub Pages aún no terminó de publicar

### Revisar
- `service-worker.js`
- `manifest.webmanifest`
- limpiar caché / reinstalar PWA
- confirmar push correcto al repositorio

## 11. Git no muestra la carpeta docs

### Causa más común
La carpeta está vacía.

### Solución
Agregar archivos dentro de `docs/`, por ejemplo:

- `index.md`
- `03-arquitectura-general.md`

Luego ejecutar:

```bash
git add docs
git commit -m "docs: add project documentation"
git push origin main
```

## Recomendación general

Cuando ocurra un error:

1. revisar consola del navegador
2. revisar Firestore/Storage
3. revisar reglas
4. revisar el archivo JS del módulo involucrado
5. confirmar si el problema es de datos, UI o permisos

## Resumen

La mayoría de fallos del sistema suelen caer en una de estas categorías:

- permisos
- estructura de datos
- reglas de Firebase
- formato de fechas/horas
- caché/PWA
- acoplamiento entre frontend y Firestore
