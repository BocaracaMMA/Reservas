# Reportes

## Objetivo

El módulo de reportes permite consultar la asistencia por período, visualizar el detalle por día y exportar la información a Excel para uso administrativo.

## Archivos principales

- `admin-reportes.html`
- `js/admin-reportes.js`
- `js/descargar-reportes.js`

## Qué permite hacer

- seleccionar año y mes
- visualizar días con asistencia
- consultar métricas rápidas
- revisar detalle por día
- exportar reportes en Excel
- elegir entre alcance mensual o histórico
- generar vista detallada o resumen

## Problema histórico resuelto

Una versión anterior del módulo dependía de los documentos padre de `asistencias`.

Eso causaba fallos cuando la asistencia existía realmente en subcolecciones como:

- `asistencias/{fecha}/usuarios/{uid}`

pero el documento padre no estaba creado como documento consultable.

La solución actual es leer directamente los registros reales de asistencia y construir el reporte desde ahí.

## Fuente de datos real

El reporte toma sus datos desde las rutas de asistencia guardadas en Firestore.

Casos válidos:

- `asistencias/{fecha}/usuarios/{uid}`
- variantes compatibles cuando la lógica de asistencia lo requiera, siempre que el parser de exportación las soporte

## Vista en pantalla

La página muestra:

- métricas del período
- agrupación por día
- total de registros
- presentes
- ausentes
- tablas diarias

Además, la interfaz fue optimizada para móvil/PWA, con cards y bloques responsivos.

## Exportación a Excel

La exportación actual busca generar archivos más profesionales.

Elementos que puede incluir:

- hoja de detalle
- hoja de resumen
- hoja de información
- hoja de configuración
- filtros automáticos
- anchos de columna ajustados
- nombres de archivo claros

## Tipos de reporte

### Detallado
Incluye columnas como:

- fecha
- nombre
- hora
- estado
- tipo de clase
- profesor

### Resumen
Agrupa por alumno y muestra:

- total de clases
- presentes
- ausentes
- porcentaje de asistencia

## Alcance

### Mes seleccionado
Lee únicamente el rango correspondiente al año y mes elegidos.

### Histórico completo
Lee todos los registros compatibles para construir un reporte global.

## Vista previa

La página también puede mostrar una tabla de previsualización alineada con la información que se descarga.

Esto ayuda a validar:

- columnas elegidas
- volumen aproximado de datos
- orden de la información

## Dependencias

La exportación usa la librería `xlsx`.

Esto permite:

- construir libros y hojas
- generar archivos descargables
- definir hojas múltiples
- aplicar filtros y ajustes estructurales

## Consideraciones importantes

- el reporte depende de la estructura real de asistencias
- cualquier cambio en cómo se guardan asistencias debe reflejarse aquí
- si se agregan nuevas variantes de ruta, el normalizador debe actualizarse

## Buenas prácticas futuras

- agregar resumen por profesor
- agregar resumen por tipo de clase
- agregar resumen por día
- mejorar trazabilidad de ausencias/presencias por rango largo
- mantener consistencia entre vista en pantalla y archivo exportado

## Resumen

El módulo de reportes convierte las asistencias reales en:

- visualización operativa
- análisis rápido
- exportación administrativa usable
