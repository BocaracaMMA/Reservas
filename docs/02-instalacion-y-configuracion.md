# Instalación y configuración

## Requisitos

Para trabajar con Bocaraca Reservas se necesita:

- navegador moderno
- cuenta y proyecto de Firebase
- acceso al repositorio del sistema
- editor de código como VS Code
- hosting estático, actualmente GitHub Pages

## Estructura base esperada

La raíz del proyecto contiene archivos y carpetas como:

- `index.html`
- páginas administrativas y de cliente
- `css/`
- `js/`
- `assets/`
- `docs/`
- `manifest.webmanifest`
- `service-worker.js`
- `firebase.json`

## Clonar el proyecto

```bash
git clone <URL_DEL_REPO>
cd bocaraca_demo
```

## Configuración de Firebase

La conexión principal del sistema se define en:

- `js/firebase-config.js`

Ese archivo debe contener la configuración del proyecto Firebase correcto.

### Servicios usados

- Firebase Authentication
- Cloud Firestore
- Firebase Storage

## Archivos críticos de configuración

### `js/firebase-config.js`
Inicializa Firebase y exporta referencias reutilizadas por el sistema.

### `firebase.json`
Define configuración relacionada con Firebase Hosting u otras integraciones según el entorno.

### Reglas de Firestore
Controlan permisos de lectura y escritura para:

- usuarios
- reservas
- asistencias
- pagos
- eventos
- excepciones de calendario

### Reglas de Storage
Controlan carga y lectura de comprobantes y otros archivos.

## Ejecución local

Como es un proyecto estático, puede abrirse con servidor local simple.

Ejemplos:

### Con VS Code Live Server
Abrir el proyecto y ejecutar Live Server.

### Con Python

```bash
python -m http.server 5500
```

Luego abrir en navegador:

```text
http://localhost:5500
```

## Despliegue

El sistema está preparado para despliegue estático.

### Opción actual
- GitHub Pages

### Consideraciones
- confirmar rutas relativas
- validar carga de assets
- revisar comportamiento de service worker después de cambios grandes
- confirmar que `manifest.webmanifest` apunte correctamente a íconos y nombre de app

## PWA

Archivos principales:

- `manifest.webmanifest`
- `service-worker.js`
- `js/pwa-install.js`
- `js/sw-register.js`

Después de cambios visuales o funcionales importantes, conviene probar:

- instalación en móvil
- navegación offline parcial
- actualización de caché
- recarga limpia

## Pasos recomendados después de clonar

1. revisar `firebase-config.js`
2. confirmar proyecto Firebase correcto
3. validar reglas de Firestore y Storage
4. correr localmente
5. probar login
6. probar panel admin y panel cliente
7. probar reservas, asistencias y pagos
8. probar PWA

## Archivos sensibles a revisar antes de producción

- `js/firebase-config.js`
- reglas de Firestore
- reglas de Storage
- `manifest.webmanifest`
- `service-worker.js`

## Resumen

La instalación del sistema no requiere backend propio adicional, pero sí depende de:

- configuración correcta de Firebase
- estructura estable del proyecto
- despliegue estático consistente
- validación funcional en móvil y escritorio
