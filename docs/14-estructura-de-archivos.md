# Estructura de archivos

## Objetivo

Este documento resume la organización general del proyecto para facilitar mantenimiento, incorporación de cambios y documentación futura.

## Raíz del proyecto

En la raíz se encuentran:

- páginas HTML principales
- carpeta `css/`
- carpeta `js/`
- carpeta `assets/`
- carpeta `docs/`
- archivos de configuración PWA
- archivos auxiliares de Firebase y despliegue

## Páginas principales

### Acceso
- `index.html`
- `register.html`
- `change-password.html`

### Administración
- `admin-dashboard.html`
- `admin-usuarios.html`
- `admin-roles.html`
- `admin-mensualidades.html`
- `admin-reportes.html`
- `admin-calendario.html`
- `admin-metrics.html`

### Cliente
- `client-dashboard.html`
- `client-profile.html`
- `client-pagos.html`

### Otras páginas operativas
- páginas de asistencias
- páginas de eventos
- páginas auxiliares según evolución del sistema

## Carpeta `js/`

Contiene la lógica principal.

### Archivos base
- `firebase-config.js`
- `script.js`
- `showAlert.js`
- `toast.js`
- `role-guard.js`
- `visibility-rules.js`

### Lógica de acceso
- `login.js`
- `register.js`

### Admin
- `admin-calendario.js`
- `admin-mensualidades.js`
- `admin-reportes.js`
- `descargar-reportes.js`
- `admin-metrics.js`
- `admin-roles.js`
- `admin-asistencias.js`

### Cliente
- `client.js`
- `client-pagos.js`

### Asistencias
- `marcar-asistencia.js`
- `scan-asistencia.js`

### PWA
- `pwa-install.js`
- `sw-register.js`

## Carpeta `css/`

Contiene principalmente:

- `style.css`

Este archivo centraliza la mayor parte de la apariencia del sistema.

## Carpeta `assets/`

Contiene recursos visuales y estáticos como:

- logos
- íconos
- favicons
- imágenes del sistema

## Carpeta `docs/`

Contiene la documentación interna del proyecto en Markdown.

Archivos recomendados:

- arquitectura
- autenticación
- reservas
- mensualidades
- reportes
- seguridad
- troubleshooting

## Archivos PWA

- `manifest.webmanifest`
- `service-worker.js`
- `offline.html`

## Organización funcional

La estructura actual está orientada por módulos y páginas. No es una SPA, por lo que cada pantalla importante tiene su propio HTML y suele apoyarse en uno o varios archivos JS.

## Ventajas de esta estructura

- despliegue simple
- fácil compatibilidad con GitHub Pages
- separación clara entre pantallas
- curva de entrada baja para mantenimiento

## Costos o desventajas

- la lógica puede dispersarse entre varios archivos
- algunos estilos globales exigen cuidado para no afectar otras páginas
- cambios estructurales requieren revisar múltiples archivos relacionados

## Recomendación

Cuando se agregue un nuevo módulo:

1. crear página HTML específica si aplica
2. crear script dedicado en `js/`
3. documentarlo en `docs/`
4. revisar impacto en `style.css`
5. validar guards y reglas de Firebase

## Resumen

La estructura del proyecto está pensada para ser práctica y modular dentro de un enfoque estático basado en HTML, CSS, JavaScript vanilla y Firebase.
