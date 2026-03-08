# PWA y modo offline

## Objetivo

Este documento resume el comportamiento del sistema como aplicación web progresiva y las consideraciones principales para uso móvil y caché.

## Archivos principales

- `manifest.webmanifest`
- `service-worker.js`
- `offline.html`
- `js/pwa-install.js`
- `js/sw-register.js`

## Qué aporta la PWA

La PWA permite que el sistema:

- pueda instalarse en el celular
- tenga apariencia cercana a una app
- funcione mejor en acceso repetido
- conserve ciertos recursos en caché
- ofrezca experiencia más cómoda en móvil

## Manifest

El archivo `manifest.webmanifest` define elementos como:

- nombre de la app
- nombre corto
- colores del tema
- íconos
- modo de visualización

Esto impacta cómo se presenta la app al instalarse.

## Service Worker

El `service-worker.js` administra la lógica de caché y actualización.

Responsabilidades comunes:

- cachear archivos estáticos
- servir contenido offline básico
- ayudar a actualizar versiones del frontend

## Instalación

El archivo `js/pwa-install.js` apoya el flujo de instalación cuando el navegador lo permite.

## Registro

El archivo `js/sw-register.js` se encarga del registro del service worker.

## Limitaciones del modo offline

El sistema usa Firebase y gran parte de su valor depende de conectividad real. Por eso el modo offline no debe interpretarse como operación total sin internet.

En la práctica, el offline sirve para:

- mantener recursos visuales cacheados
- abrir ciertas pantallas estáticas
- mejorar sensación de app instalada

Pero no reemplaza completamente operaciones como:

- autenticación remota
- lectura y escritura sincronizada en Firestore
- carga de comprobantes a Storage

## Buenas prácticas

- probar siempre después de cambios grandes
- revisar si el service worker está sirviendo archivos viejos
- forzar actualización cuando se cambian recursos sensibles
- validar experiencia real en Android y iPhone

## Problemas comunes

- cambios no reflejados por caché vieja
- PWA mostrando versión antigua
- assets no actualizados
- comportamiento distinto entre navegador normal y app instalada

## Recomendaciones

- versionar recursos sensibles cuando haga falta
- revisar el manifest después de cambios de branding
- validar las pantallas principales como PWA real
- mantener enfoque mobile-first en todo cambio visual

## Resumen

La PWA mejora mucho la experiencia móvil del sistema, pero debe mantenerse con cuidado para evitar problemas de caché y falsas expectativas sobre soporte offline total.
