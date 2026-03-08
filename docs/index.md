# Bocaraca Reservas

Sistema web administrativo y operativo para academias de artes marciales, diseñado para gestionar reservas, asistencias, mensualidades, pagos y reportes desde una interfaz optimizada para móvil y escritorio.

## Objetivo del sistema

Bocaraca Reservas centraliza procesos que normalmente se manejan de forma manual o dispersa:

- reservas de clases por horario
- control de asistencia
- gestión de mensualidades
- envío y validación de comprobantes
- reportes administrativos
- configuración del calendario semanal
- manejo de días especiales y excepciones

## Stack principal

- HTML, CSS y JavaScript vanilla
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- GitHub Pages
- PWA con Service Worker

## Módulos principales

- Autenticación y acceso
- Panel administrativo
- Panel cliente
- Calendario y reservas
- Asistencias
- Mensualidades
- Reportes
- Eventos
- PWA y soporte móvil

## Enfoque del proyecto

El sistema está pensado para:

- funcionar bien en celulares y como PWA
- reducir fricción operativa para administración y alumnos
- mantener una arquitectura simple basada en frontend estático + Firebase
- permitir evolución incremental sin reescribir todo el sistema

## Documentación incluida

- [Arquitectura general](./03-arquitectura-general.md)
- [Autenticación y roles](./04-autenticacion-y-roles.md)
- [Calendario y reservas](./07-calendario-y-reservas.md)
- [Mensualidades](./09-mensualidades.md)
- [Reportes](./10-reportes.md)
