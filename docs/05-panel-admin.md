# Panel admin

## Objetivo

El panel administrativo concentra las herramientas necesarias para operar el sistema, gestionar usuarios y configurar módulos clave del negocio.

## Páginas principales del panel admin

Dependiendo de la versión actual del proyecto, el panel administrativo se apoya en páginas como:

- `admin-dashboard.html`
- `admin-usuarios.html`
- `admin-roles.html`
- `admin-mensualidades.html`
- `admin-reportes.html`
- `admin-calendario.html`
- `admin-metrics.html`

## Acceso

El acceso al panel administrativo requiere:

- autenticación válida
- rol permitido en Firestore
- validación desde frontend
- validación efectiva mediante reglas de Firebase cuando aplica

## Funciones principales

### Dashboard administrativo

La pantalla principal resume el estado del sistema y permite navegar a módulos operativos. Dependiendo de la implementación actual, puede mostrar:

- accesos rápidos
- métricas resumidas
- estado del calendario
- indicadores de alumnos o pagos

### Gestión de usuarios

Permite revisar y administrar usuarios del sistema, incluyendo:

- datos personales
- visibilidad
- permisos o estado
- acceso a módulos relacionados

### Roles

El módulo de roles permite asignar o revisar capacidades administrativas y operativas de usuarios autorizados.

Roles relevantes:

- admin
- professor
- dev

### Mensualidades

Permite:

- ver quién está activo, próximo a vencer o vencido
- registrar pagos
- anular mensualidades
- actualizar autorización

### Calendario

Permite:

- configurar clases recurrentes
- editar horarios
- ajustar cupos
- manejar profesores
- bloquear fechas
- definir horarios especiales

### Reportes

Permite:

- consultar asistencias por período
- revisar detalle por día
- exportar a Excel
- ver resumen por alumno

### Métricas

El módulo de métricas resume indicadores operativos del sistema y apoya decisiones administrativas.

## Sidebar y navegación

El panel administrativo usa navegación lateral para mantener acceso rápido a módulos. Esa navegación debe mantenerse consistente entre páginas admin.

## Reglas de trabajo recomendadas

- cualquier cambio visual debe respetar compatibilidad móvil
- cualquier módulo admin debe usar guards de rol
- cambios sensibles deben revisar impacto en Firestore
- se debe evitar mezclar lógica admin con cliente dentro del mismo flujo visual

## Riesgos comunes

- permitir acceso admin solo por UI y no por reglas
- romper consistencia del sidebar
- modificar datos operativos sin revisar módulos dependientes
- hacer cambios en calendario o mensualidades sin validar cliente y reportes

## Buenas prácticas futuras

- mantener patrones visuales consistentes
- centralizar componentes visuales repetidos
- reforzar guards comunes en páginas admin
- documentar dependencias entre módulos

## Resumen

El panel admin es el núcleo de control del sistema y agrupa los módulos que afectan calendario, usuarios, pagos, reportes y operación general.
