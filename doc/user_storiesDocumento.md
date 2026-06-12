# User Stories por Rol
## TrackWise — Plataforma de Análisis Predictivo Musical


---

## Convenciones



> **Como** [rol], **quiero** [acción], **para** [beneficio].

Campos adicionales:
- **Criterios de aceptación** — condiciones verificables que deben cumplirse para considerar la historia completada.

---

## Roles

| Rol | Descripción |
|---|---|
| **Usuario normal** | Usuario gratuito. Accede a la plataforma por curiosidad. Analiza canciones existentes mediante link de YouTube. |
| **Productor musical** | Usuario de pago. Evalúa canciones propias en proceso de producción. Carga archivos MP3 para análisis. |
| **Sistema** | Actor secundario que representa comportamientos automáticos de la plataforma (validaciones, sesiones, redirecciones). |

---

## 1. Autenticación y sesiones

---

### Registro de cuenta

**Como** usuario (cualquier rol),
**quiero** registrarme con mi correo electrónico, contraseña y tipo de cuenta,
**para** acceder a las funcionalidades de la plataforma según mi perfil.

**Criterios de aceptación:**
- El formulario solicita correo, contraseña y selección de rol (Usuario normal / Productor musical).
- El sistema valida que el correo tenga formato válido y que la contraseña cumpla los requisitos mínimos.
- Si el correo ya está registrado, se muestra un mensaje de error específico.
- Al completar el registro exitosamente, el usuario es redirigido a su panel correspondiente según el rol seleccionado.
- El registro es gestionado por Keycloak; la contraseña nunca es almacenada en texto plano.


---

### US-002 — Inicio de sesión

**Como** usuario registrado,
**quiero** iniciar sesión con mi correo y contraseña,
**para** acceder a mi panel y retomar mis análisis.

**Criterios de aceptación:**
- El formulario solicita correo y contraseña.
- Si las credenciales son incorrectas, se muestra un mensaje de error sin revelar cuál de los dos campos es incorrecto.
- Al iniciar sesión correctamente, el sistema emite un JWT firmado con RS256 y redirige al usuario a su panel según su rol.
- El token vive en memoria del cliente y viaja como header `Authorization: Bearer` en cada petición.
- Si el usuario ya tiene sesión activa e intenta acceder al login, es redirigido a su panel directamente.


---

### US-003 — Cierre de sesión

**Como** usuario autenticado,
**quiero** cerrar sesión de forma explícita,
**para** asegurarme de que nadie más pueda usar mi cuenta desde este dispositivo.

**Criterios de aceptación:**
- El botón "Cerrar sesión" es visible y accesible desde cualquier pantalla del panel.
- Al cerrar sesión, el token es invalidado en Keycloak y eliminado de la memoria del cliente.
- El usuario es redirigido a la pantalla de login.
- Si intenta navegar hacia atrás o acceder a una ruta protegida, es redirigido al login.


---

### US-004 — Renovación automática de sesión

**Como** usuario autenticado,
**quiero** que mi sesión se mantenga activa mientras estoy usando la plataforma,
**para** no perder mi trabajo o ser desconectado de forma inesperada.

**Criterios de aceptación:**
- El sistema renueva el token de acceso automáticamente antes de que expire, usando el refresh token.
- La renovación ocurre en segundo plano, sin interrumpir la experiencia del usuario.
- Si el refresh token también expira (sesión inactiva prolongada), el usuario es redirigido al login con un mensaje informativo.


---

### US-005 — Protección de rutas por rol

**Como** sistema,
**quiero** redirigir automáticamente a los usuarios si intentan acceder a rutas que no corresponden a su rol,
**para** garantizar que cada usuario solo vea las funcionalidades que le pertenecen.

**Criterios de aceptación:**
- Un Usuario normal que intente acceder a `/producer` es redirigido a `/user`.
- Un Productor musical que intente acceder a `/user` es redirigido a `/producer`.
- Un usuario no autenticado que intente acceder a cualquier ruta protegida es redirigido a `/login`.



---

## 2. Análisis de audio — Usuario normal

---

### US-010 — Analizar canción por link de YouTube

**Como** usuario normal,
**quiero** ingresar el link de una canción en YouTube y obtener un análisis predictivo,
**para** saber qué tan probable es que esa canción tenga éxito comercial.

**Criterios de aceptación:**
- El panel del Usuario normal muestra un campo de entrada para link de YouTube.
- El sistema valida en tiempo real que el link tenga formato de URL de YouTube válida; si no es válido, muestra un error inline que desaparece al corregir el campo.
- Al enviar un link válido (botón o tecla `Enter`), el sistema muestra la pantalla de carga con mensajes de progreso.
- Al completar el análisis, el sistema presenta las cuatro métricas predichas: probabilidad de éxito (%), vistas estimadas, likes estimados y comentarios estimados.
- Si el análisis falla (error de red, video no disponible), se muestra un mensaje de error claro con opción de reintentar.


---

### US-011 — Ver resultados del análisis

**Como** usuario normal,
**quiero** ver los resultados del análisis de forma clara y visualmente organizada,
**para** entender fácilmente qué predicciones hizo el sistema sobre la canción.

**Criterios de aceptación:**
- La pantalla de resultados muestra las cuatro métricas en tarjetas o componentes visuales diferenciados.
- Cada métrica incluye su etiqueta descriptiva y su valor predicho.
- Si no hay un análisis activo, se muestra un estado vacío con mensaje y acción para iniciar un nuevo análisis.
- El usuario puede iniciar un nuevo análisis desde la pantalla de resultados.

**Prioridad:** Must | **RFs relacionados:** RF-016

---

## 3. Análisis de audio — Productor musical

---

### US-020 — Analizar canción propia cargando un MP3

**Como** productor musical,
**quiero** subir un archivo MP3 de una canción que estoy produciendo,
**para** obtener una predicción de su potencial comercial antes de lanzarla.

**Criterios de aceptación:**
- El panel del Productor musical muestra un componente de carga de archivo (`FileUploadDropzone`) que acepta archivos `.mp3`.
- El componente admite selección por clic y arrastrar y soltar (drag & drop).
- Si el archivo seleccionado no es `.mp3`, se muestra el mensaje "Solo se permiten archivos .mp3" y no se procesa.
- Al seleccionar un archivo `.mp3` válido, el componente confirma visualmente la selección (ícono de check, nombre del archivo, mensaje de estado).
- Al enviar, el sistema muestra la pantalla de carga con mensajes de progreso.
- Al completar el análisis, se presentan las cuatro métricas predichas.
- El usuario puede cambiar el archivo seleccionado antes de enviar haciendo clic nuevamente en el componente.

**Prioridad:** Must | **RFs relacionados:** RF-010, RF-011, RF-014, RF-015, RF-016, RF-017

---

### US-021 — Analizar canción por link de YouTube (Productor)

**Como** productor musical,
**quiero** también poder analizar canciones existentes en YouTube mediante un link,
**para** comparar el potencial de mi producción con canciones de referencia del mercado.

**Criterios de aceptación:**
- El panel del Productor musical incluye la opción de análisis por link de YouTube, además de la carga de MP3.
- El comportamiento de validación y análisis es idéntico al del Usuario normal (US-010).

**Prioridad:** Must | **RFs relacionados:** RF-012, RF-013, RF-014, RF-015, RF-016

---

### US-022 — Acceso restringido a carga de MP3 para Usuario normal

**Como** usuario normal,
**quiero** ver un mensaje claro cuando intento acceder a la funcionalidad de carga de MP3,
**para** entender que esa función es exclusiva de la cuenta de Productor y saber cómo obtenerla.

**Criterios de aceptación:**
- Si un Usuario normal accede a la ruta del Productor, es redirigido a su propio panel (ver US-005).
- En el panel del Usuario normal no aparece el componente de carga de MP3 ni ninguna referencia engañosa a él.
- Existe un mensaje o indicador que comunica la existencia de la versión Productor y sus beneficios adicionales.

**Prioridad:** Must | **RFs relacionados:** RF-031

---

## 4. Historial

---

### US-030 — Consultar historial de análisis

**Como** usuario autenticado (cualquier rol),
**quiero** ver el historial de todos los análisis que he realizado,
**para** revisar predicciones anteriores sin tener que repetir el análisis.

**Criterios de aceptación:**
- La sección de historial es accesible desde el menú lateral.
- El historial muestra los análisis ordenados por fecha descendente (más reciente primero).
- Cada entrada del historial muestra como mínimo: identificador o nombre de la canción, fecha del análisis y las cuatro métricas predichas.
- Si el usuario no tiene análisis previos, se muestra un estado vacío con mensaje y acción para realizar el primer análisis.

**Prioridad:** Must | **RFs relacionados:** RF-020, RF-021, RF-022

---

### US-031 — Ver detalle de un análisis previo

**Como** usuario autenticado,
**quiero** acceder al detalle completo de un análisis anterior desde el historial,
**para** revisar todos los datos de esa predicción sin perder información.

**Criterios de aceptación:**
- Cada entrada del historial permite navegar a una vista de detalle.
- La vista de detalle muestra la misma información que la pantalla de resultados original.
- El usuario puede volver al historial desde la vista de detalle.

**Prioridad:** Should | **RFs relacionados:** RF-023

---

## 5. Resumen por rol

### Usuario normal

| ID | Historia | Prioridad |
|---|---|---|
| US-001 | Registro de cuenta | Must |
| US-002 | Inicio de sesión | Must |
| US-003 | Cierre de sesión | Must |
| US-004 | Renovación automática de sesión | Must |
| US-010 | Analizar canción por link de YouTube | Must |
| US-011 | Ver resultados del análisis | Must |
| US-022 | Acceso restringido a carga de MP3 | Must |
| US-030 | Consultar historial de análisis | Must |
| US-031 | Ver detalle de un análisis previo | Should |

### Productor musical

| ID | Historia | Prioridad |
|---|---|---|
| US-001 | Registro de cuenta | Must |
| US-002 | Inicio de sesión | Must |
| US-003 | Cierre de sesión | Must |
| US-004 | Renovación automática de sesión | Must |
| US-020 | Analizar canción propia cargando un MP3 | Must |
| US-021 | Analizar canción por link de YouTube | Must |
| US-011 | Ver resultados del análisis | Must |
| US-030 | Consultar historial de análisis | Must |
| US-031 | Ver detalle de un análisis previo | Should |

### Sistema (comportamientos automáticos)

| ID | Historia | Prioridad |
|---|---|---|
| US-005 | Protección de rutas por rol | Must |
