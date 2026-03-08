# Roadmap

## Objetivo

Este documento reúne posibles mejoras futuras para Bocaraca Reservas. No implica compromiso inmediato de implementación, pero ayuda a ordenar prioridades técnicas y funcionales.

## Prioridades funcionales futuras

### 1. Fortalecer guards de acceso
Aplicar de forma consistente el control de vencimiento y autorización en todas las páginas cliente sensibles, no solo en login.

### 2. Mejorar reportes
Agregar nuevos tipos de análisis como:

- resumen por profesor
- resumen por tipo de clase
- resumen por día
- tendencias por mes

### 3. Trazabilidad de pagos
Agregar más historial o auditoría para:

- pagos anulados
- cambios de mensualidad
- acciones administrativas sensibles

### 4. Documentación completa
Terminar toda la serie de documentación del proyecto y, si conviene, publicarla como sitio con MkDocs o similar.

## Prioridades técnicas futuras

### 5. Logger o sistema de errores
Crear captura básica de errores para revisarlos desde admin o al menos centralizarlos en Firebase.

### 6. Refactor de módulos repetidos
Revisar scripts o patrones duplicados que puedan unificarse sin romper estabilidad.

### 7. Más aislamiento visual por módulo
Seguir encapsulando estilos por página para reducir riesgo de efectos colaterales.

### 8. Mejoras PWA
Pulir más la experiencia de instalación y actualización de caché.

## Prioridades visuales futuras

### 9. Unificar el nivel visual del sistema
Mantener consistencia moderna entre:

- reportes
- calendario admin
- dashboard admin
- dashboard cliente
- modales
- formularios

### 10. Optimización extrema para celular
Seguir probando y puliendo pantallas para anchos pequeños y uso táctil real.

## Prioridades operativas futuras

### 11. Mejoras en calendario y excepciones
Hacer más claro el manejo de horarios especiales y días bloqueados.

### 12. Mejoras en asistencias
Definir con más precisión estados de asistencia y posibles flujos por clase o por profesor.

### 13. Mejoras en métricas
Aumentar valor del panel con indicadores más útiles para administración.

## Criterio recomendado de evolución

El sistema debe seguir creciendo sin perder estas prioridades:

- estabilidad
- compatibilidad móvil
- claridad operativa
- simplicidad técnica
- bajo costo de despliegue

## Resumen

El roadmap del proyecto debe enfocarse en mejorar operación, trazabilidad, experiencia móvil y mantenibilidad sin convertir el sistema en algo innecesariamente complejo.
