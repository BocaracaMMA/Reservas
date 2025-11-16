# Bocaraca Reservas  
Sistema web para control de alumnos, mensualidades, asistencias y reservas de clases

Bocaraca Reservas es una aplicación web pensada para academias de artes marciales / gimnasios que quieren dejar atrás las hojas de Excel y llevar **todo el control del gym en un solo lugar**:

- Alumnos y sus datos de contacto  
- Membresías y mensualidades  
- Pagos y estado al día / atrasado  
- Asistencias a clases  
- Reportes y métricas

Funciona en navegador (computadora, tablet o celular) y puede desplegarse fácilmente en Firebase Hosting o GitHub Pages.

---

## 1. ¿Qué problema resuelve?

En un gym típico pasan varias cosas todos los días:

- Hay que saber **quién está inscrito** y qué plan tiene.
- Hay que verificar **quién está al día con el pago** y quién no.
- En recepción se necesita una forma rápida de **marcar asistencia**.
- El dueño quiere ver **reportes y métricas** (cuántos activos, cuántos vienen, quiénes abandonan, etc.).

Normalmente esto se hace con:

- Libretas de papel
- Hojas de Excel distintas
- Mensajes de WhatsApp regados

Eso es difícil de mantener, se pierde información y no hay una “versión única de la verdad”.

**Bocaraca Reservas** junta todo esto en un solo sistema, accesible desde cualquier dispositivo con internet, con la información centralizada en la nube.

---

## 2. Usuarios y roles

El sistema está pensado principalmente para dos tipos de usuarios:

### 2.1. Administrador / Staff

Son las personas del gym que gestionan todo:

- Crean y editan **usuarios** (alumnos).
- Configuran **planes / mensualidades**.
- Marcan o corrigen **asistencias**.
- Revisan **reportes** y **métricas**.
- Gestionan **roles** (qué puede y qué no puede ver cada tipo de usuario).

Desde el código se ve reflejado en páginas como:

- `admin-dashboard.html`
- `admin-usuarios.html` / `admin-users.html`
- `admin-mensualidades.html`
- `admin-asistencias.html`
- `admin-roles.html`
- `admin-metrics.html`
- `reportes.html`

### 2.2. Cliente / Alumno

Son los estudiantes del gym. Tienen un acceso más sencillo, enfocado en:

- Ver su **perfil** y datos personales.
- Ver el estado de sus **pagos** / mensualidades.
- Consultar **eventos / clases especiales**.
- Opcionalmente, marcar asistencia o revisar su historial (según cómo se configure).

En el proyecto se ve en:

- `client-dashboard.html`
- `client-pagos.html`
- `profile.html`
- `events.html`

---

## 3. Flujo general del sistema

A grandes rasgos, el sistema funciona así:

1. **Acceso al sistema**
   - El usuario entra a `index.html` (pantalla de login).
   - Si no tiene cuenta, se registra desde `register.html`.
   - El sistema valida las credenciales contra Firebase (autenticación en la nube).

2. **Según el rol, se redirige al panel correcto**
   - Si es **cliente**, se envía a `client-dashboard.html`.
   - Si es **admin**, se envía a `admin-dashboard.html`.

3. **Desde el panel se navega con un menú lateral**
   - En el panel admin hay un sidebar con accesos a:
     - Inicio
     - Usuarios
     - Mensualidades
     - Asistencias
     - Reportes
     - Cerrar sesión
   - Esta navegación se comparte entre las páginas de administración para mantener una experiencia consistente.

4. **Toda la información se guarda en la nube**
   - El sistema usa **Firebase** (Firestore) como base de datos.
   - Cada acción importante (crear usuario, marcar asistencia, registrar un pago, etc.) se guarda inmediatamente en la nube.

---

## 4. Módulos principales (lo que el cliente realmente obtiene)

### 4.1. Gestión de usuarios (Alumnos)

**Objetivo**: Tener un registro limpio y centralizado de todos los alumnos.

- Alta y edición de usuarios desde páginas como `admin-usuarios.html` / `admin-users.html`.
- Datos típicos:
  - Nombre completo
  - Correo electrónico
  - Teléfono
  - Estado (activo / inactivo)
  - Rol (cliente, admin, etc.)
- Posibilidad de resetear contraseña o cambiarla desde `change-password.html`.

**Beneficio para el cliente**:  
Deja de depender de Excel y papeles, cualquier persona del staff puede ver el listado actualizado de alumnos desde cualquier dispositivo.

---

### 4.2. Control de mensualidades y pagos

**Objetivo**: Saber rápidamente quién está al día y quién no.

En páginas como `admin-mensualidades.html` y `client-pagos.html`:

- El admin puede:
  - Ver las mensualidades de cada alumno.
  - Marcar pagos como realizados.
  - Ver quién está atrasado.
- El cliente puede:
  - Consultar su estado de cuenta.
  - Ver qué plan tiene y hasta cuándo está vigente.

**Beneficio para el cliente (dueño del gym)**:  
En segundos puede contestar preguntas como:

- “¿Cuántos alumnos activos tengo este mes?”
- “¿Quiénes están atrasados con el pago?”

---

### 4.3. Asistencias (control diario)

**Objetivo**: Llevar el control real de quién está viniendo a entrenar.

Con `marcar-asistencia.html` y `admin-asistencias.html`:

- El staff puede marcar asistencia de los alumnos al llegar.
- Las asistencias se registran en Firestore con fecha/hora.
- El admin puede:
  - Buscar asistencias por rango de fechas.
  - Revisar el historial de un alumno.
  - Corregir capturas en caso de errores.

**Beneficio**:  
Permite ver no solo quién paga, sino quién realmente entrena (retención, compromiso, etc.).

---

### 4.4. Reportes y exportaciones

**Objetivo**: Transformar los datos en información útil.

En `reportes.html`:

- Se generan reportes basados en la información de:
  - Usuarios
  - Pagos / mensualidades
  - Asistencias
- Se pueden filtrar por:
  - Fechas
  - Estado (activo, inactivo, al día, atrasado, etc.)
- Existe integración con exportación a Excel (usando librerías tipo SheetJS desde el front), para que el dueño pueda:
  - Pasar reportes a contabilidad.
  - Guardar respaldos.
  - Hacer análisis propios en Excel si lo desea.

**Beneficio**:  
La información deja de estar “encerrada” en el sistema. El cliente puede descargarse los datos y trabajarlos como quiera.

---

### 4.5. Métricas de negocio (Panel de control)

En `admin-metrics.html` el sistema muestra indicadores de alto nivel, típicamente:

- Cuántos alumnos activos hay.
- Tendencias en asistencias.
- Información agregada útil para la toma de decisiones.

**Beneficio**:  
El dueño ya no tiene que armar gráficos a mano: el sistema le muestra un resumen listo para interpretar.

---

### 4.6. Eventos y reservas

En `events.html` (y otras páginas relacionadas):

- Se pueden listar **eventos especiales** o seminarios.
- Dependiendo de la versión, es posible:
  - Llevar un control de quién se apuntó.
  - Usar la misma base de usuarios para gestionar reservas.

**Beneficio**:  
Permite organizar seminarios, torneos internos u otros eventos sin tener que crear una hoja de cálculo aparte.

---

## 5. Experiencia de uso para el alumno

Desde el punto de vista del alumno, la experiencia típica es:

1. Se registra en `register.html` o es creado desde administración.
2. Inicia sesión en `index.html`.
3. Es redirigido a `client-dashboard.html`, donde puede:
   - Ver un resumen de su estado.
   - Consultar su plan y pagos (`client-pagos.html`).
   - Ver eventos (`events.html`) y otra información relevante.
4. Puede actualizar ciertos datos básicos en `profile.html`.
5. Según cómo se configure, puede ver su propio historial de asistencias.

---

## 6. Experiencia de uso para el staff y administrador

El staff inicia sesión y entra a `admin-dashboard.html`, desde donde:

- Usa el **sidebar** para moverse entre:
  - Inicio (resumen rápido)
  - Usuarios (alta/baja/modificación)
  - Mensualidades (control de pagos)
  - Asistencias (marcar y revisar)
  - Reportes (descargar información)
  - Métricas (ver indicadores)
- Marca asistencias en `marcar-asistencia.html`, normalmente desde una PC en recepción o una tablet.
- Genera reportes en `reportes.html` para revisiones internas o entrega a contabilidad.
- Usa `admin-roles.html` para mantener ordenado quién tiene permiso de ver y cambiar qué.

---

## 7. Arquitectura técnica (explicado en simple)

Aunque el cliente no necesita entrar al código, es bueno saber **cómo está construido**:

- Es una **aplicación web 100% front-end**, usando:
  - **HTML + CSS + JavaScript**
  - Estructurada en múltiples páginas (`.html`) para cada sección.
- Los datos se guardan en la nube usando **Firebase (Firestore)**.
  - No hay un servidor propio tipo “backend” que haya que mantener.
  - Firebase se encarga de la base de datos y la autentificación.
- El archivo `firebase.json` define la configuración para el despliegue en Firebase Hosting.
- `service-worker.js`, `manifest.webmanifest` y `offline.html` preparan la app para funcionar como **PWA**:
  - Mejor comportamiento en conexiones malas.
  - Posibilidad de mostrar una pantalla offline amigable.

**¿Qué significa esto para el cliente?**

- Menos infraestructura que mantener.
- Escala bien aunque aumenten los alumnos.
- Mientras haya internet, el sistema funciona igual en cualquier PC o dispositivo.

---

## 8. Seguridad y privacidad

A nivel general, el sistema está pensado con estas ideas:

- El acceso está protegido por autenticación (Firebase Auth).
- Cada usuario solo ve lo que corresponde a su rol.
- Los datos se almacenan en Firebase, que se ejecuta sobre la infraestructura de Google.

> Nota: La configuración fina de reglas de seguridad de Firestore y políticas de privacidad depende de cómo se configure el proyecto de Firebase del cliente.

---

## 9. Requisitos para usar el sistema en producción

Para que un cliente lo use en su gym, básicamente necesita:

1. **Cuenta de Firebase** (gratuita al inicio, con posibilidad de escalar).
2. Configurar en Firebase:
   - Un proyecto.
   - Firestore.
   - Autenticación (normalmente por email/contraseña).
3. Actualizar las credenciales de Firebase en los archivos JavaScript correspondientes (los que inicializan Firebase).
4. Desplegar el proyecto:
   - En **Firebase Hosting**, o
   - En **GitHub Pages** u otro hosting estático.
5. Usar un navegador moderno:
   - Google Chrome, Edge, Firefox, etc., en PC, tablet o celular.

---

## 10. Resumen para el cliente (en una frase)

> **Bocaraca Reservas** es un sistema web que le permite a su academia controlar alumnos, pagos, asistencias y eventos en un solo lugar, con los datos siempre disponibles en la nube y listos para generar reportes y métricas de negocio.

---

## 11. Próximos pasos / posibles extensiones

El sistema está preparado para crecer. Algunas ideas típicas:

- Integrar pasarelas de pago (para que el alumno pague en línea).
- Enviar recordatorios automáticos de vencimiento de mensualidad.
- Generar reportes gráficos más avanzados en `admin-metrics.html`.
- Crear una app móvil empaquetando la PWA.
