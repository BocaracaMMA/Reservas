# Calendario y reservas

## Objetivo

Este módulo controla el horario semanal disponible, la configuración de clases, las reservas de alumnos y las excepciones del calendario.

## Archivos principales

- `admin-calendario.html`
- `js/admin-calendario.js`
- `js/helpers-calendar.js`
- `js/client.js`

## Vista administrativa del calendario

La página administrativa permite:

- ver el horario semanal
- crear clases
- editar clases existentes
- eliminar clases
- configurar cupos
- asignar profesor
- definir tipo de clase
- manejar días especiales y excepciones

## Horario semanal base

La colección `classSchedule` contiene la configuración regular del calendario.

Cada entrada puede incluir:

- día de la semana
- hora de inicio
- hora de fin
- tipo de clase
- profesor
- cupo mínimo
- cupo máximo
- configuración permanente

## Días especiales

La colección `calendarExceptions` permite alterar el comportamiento del horario para una fecha concreta.

Casos comunes:

- bloquear todas las clases de un día
- crear un horario especial solo para una fecha
- eliminar una excepción y volver al horario base

Esto sirve para:

- feriados
- seminarios
- visitas
- actividades extraordinarias
- cierres operativos

## Calendario del cliente

El cliente ve un calendario de clases disponibles según:

- horario configurado
- cupos
- disponibilidad
- reglas de negocio
- excepciones del calendario

Desde ahí puede reservar.

## Reservas

La colección `reservations` guarda las reservas de clases.

Campos típicos relevantes:

- `userId`
- correo o usuario asociado
- fecha
- horario
- referencia a la clase
- timestamps operativos

## Reglas operativas de reservas

El sistema busca validar:

- que el usuario solo reserve para sí mismo
- que la clase exista
- que el horario no esté bloqueado
- que la reserva sea futura
- que aún haya cupo
- que no se generen duplicados inválidos

## Cancelación o eliminación de reservas

Dependiendo del rol o del tiempo restante antes de la clase:

- el propio usuario puede eliminar su reserva
- admin/dev pueden intervenir
- ciertas restricciones pueden aplicar según `slotTs`

## Relación con asistencias

Las reservas no son lo mismo que las asistencias.

- una reserva indica intención o cupo asignado
- la asistencia confirma presencia o estado de participación real

## Relación con calendario admin

La configuración del calendario en admin impacta directamente:

- lo que el cliente puede ver
- lo que el cliente puede reservar
- cómo se distribuyen los horarios

## Buenas prácticas

- mantener consistencia de formato de fecha y hora
- no mezclar excepciones con horario base sin una estrategia clara
- documentar cambios de estructura si se modifica `classSchedule`
- revisar siempre el impacto de cambios en admin sobre client dashboard

## Resumen

El módulo de calendario y reservas es el núcleo operativo del sistema porque conecta:

- configuración administrativa
- disponibilidad visible para el cliente
- control de cupos
- flujo diario de clases
