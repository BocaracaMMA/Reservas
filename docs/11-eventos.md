# Eventos

## Objetivo

El módulo de eventos permite crear y administrar actividades especiales separadas del flujo regular del calendario semanal de clases.

## Archivos relacionados

Dependiendo de la versión del proyecto, este módulo se apoya en archivos como:

- `events.html`
- `js/admin-events.js`

## Diferencia entre evento y clase regular

### Clase regular
Forma parte del horario base o del calendario semanal.

### Evento
Representa una actividad especial o puntual, por ejemplo:

- seminarios
- exhibiciones
- actividades de academia
- anuncios operativos
- cierres o sesiones especiales

## Almacenamiento

Los eventos suelen manejarse en la colección:

- `events`

## Capacidades esperadas

- crear un evento
- editarlo
- eliminarlo
- mostrarlo al usuario autorizado
- mantener separación del horario base si así lo requiere la lógica

## Casos de uso

- anunciar una actividad especial
- marcar una fecha importante
- mostrar una sesión distinta al calendario normal
- comunicar cambios operativos

## Consideraciones de seguridad

Normalmente solo admin/dev deberían tener permisos para:

- crear eventos
- modificar eventos
- eliminarlos

La lectura puede estar habilitada para usuarios autenticados si el sistema lo requiere.

## Riesgos comunes

- mezclar eventos con clases regulares sin distinción clara
- no documentar si el evento impacta reservas
- usar la misma UI del calendario sin aclarar comportamiento

## Buenas prácticas futuras

- documentar visualmente la diferencia entre evento y clase
- definir si los eventos afectan reservas o solo comunican
- mantener la colección `events` independiente del horario semanal

## Resumen

El módulo de eventos permite gestionar actividades especiales fuera del flujo normal de clases y ayuda a mantener una operación más flexible y clara.
