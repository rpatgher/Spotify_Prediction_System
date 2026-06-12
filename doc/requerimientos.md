# Requerimientos Funcionales y No Funcionales
## Plataforma de Análisis Predictivo Musical



## Convenciones

| Prefijo | Tipo |
|---|---|
| RF-XXX | Requerimiento funcional |
| RNF-XXX | Requerimiento no funcional |


---

## 1. Requerimientos Funcionales

### 1.1 Módulo de autenticación y sesiones

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-001 | El sistema debe permitir el registro de nuevos usuarios con correo electrónico y contraseña, gestionado por Keycloak. | M |
| RF-002 | El sistema debe permitir el inicio de sesión de usuarios registrados y emitir un token JWT firmado con RS256. | M | 
| RF-003 | El token JWT debe almacenarse en memoria del lado del cliente (no en localStorage ni cookies); debe viajar como header `Authorization: Bearer` en cada petición. | M |
| RF-004 | El sistema debe renovar el token de acceso automáticamente antes de su expiración usando un refresh token, sin requerir que el usuario vuelva a iniciar sesión. | M |
| RF-005 | El sistema debe permitir el cierre de sesión explícito, invalidando el token en Keycloak. | M |
| RF-006 | El sistema debe bloquear el acceso a rutas protegidas si el token es inválido, expirado o ausente, redirigiendo al login. | M |
| RF-007 | El sistema debe soportar dos roles de usuario: **Productor musical** y **Usuario normal**, con permisos diferenciados por rol (RBAC). | M |

---

### 1.2 Módulo de análisis de audio

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-010 | El sistema debe permitir al **Productor musical** cargar un archivo en formato MP3 para su análisis. | M |
| RF-011 | El sistema debe validar que el archivo cargado sea un MP3 válido, con un tamaño máximo de 15mb. | M |
| RF-012 | El sistema debe permitir al **Usuario normal** ingresar un link de YouTube para su análisis. | M |
| RF-013 | El sistema debe validar que el link ingresado corresponda a un video de YouTube accesible. | M |
| RF-014 | El sistema debe extraer características de audio del archivo MP3 o del audio del link de YouTube para alimentar el modelo de ML. | M |
| RF-015 | El sistema debe invocar el servicio de ML interno y obtener las cuatro métricas predichas: probabilidad de éxito (%), vistas estimadas, likes estimados y comentarios estimados en YouTube. | M |
| RF-016 | El sistema debe presentar los resultados del análisis al usuario con una visualización clara, indicando cada métrica de forma legible. | M |
| RF-017 | El sistema debe mostrar un indicador de progreso mientras se procesa el análisis, dado que puede tomar varios segundos. | S |

---

### 1.3 Módulo de historial

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-020 | El sistema debe registrar cada análisis realizado en la base de datos, asociado al usuario que lo ejecutó. | M |
| RF-021 | El sistema debe permitir al usuario consultar su propio historial de análisis previos, ordenado por fecha descendente. | M |
| RF-022 | El historial debe mostrar, como mínimo: nombre/identificador de la canción, fecha del análisis y las cuatro métricas predichas. | M |
| RF-023 | El sistema debe permitir al usuario acceder al detalle completo de un análisis previo desde el historial. | S |

---

### 1.4 Módulo de gestión de usuarios

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-030 | El sistema debe diferenciar las vistas y funcionalidades disponibles según el rol del usuario autenticado. | M |
| RF-031 | El sistema debe impedir que un **Usuario normal** acceda a la funcionalidad de carga de MP3, mostrando un mensaje informativo sobre la versión de pago. | M |
| RF-032 | El sistema debe impedir que un usuario no autenticado acceda a funcionalidades protegidas (análisis, historial). | M |
| RF-033 | El sistema debe permitir la asignación manual del rol **Productor musical** a un usuario (por un administrador en Keycloak). | M |

---

### 1.5 Motor de ML (servicio interno)

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-040 | El modelo de ML debe estar integrado en el backend y ser invocado internamente durante el pipeline de análisis, recibiendo las características de audio extraídas y devolviendo las cuatro métricas predichas | M |
| RF-041 | El modelo de ML debe ejecutarse exclusivamente dentro del proceso del backend; no debe estar accesible desde ningún endpoint público ni desde otros servicios. | M |
| RF-042 | El servicio debe responder en un tiempo razonable para no degradar la experiencia del usuario (umbral a definir en RNF). | M |

---

## 2. Requerimientos No Funcionales

### 2.1 Seguridad

| ID | Requerimiento | Prioridad |
|---|---|---|
| RNF-001 | Toda comunicación entre cliente y servidor debe estar cifrada mediante TLS 1.2 o superior (HTTPS). No deben existir endpoints HTTP expuestos en producción. | M |
| RNF-002 | Los tokens JWT deben estar firmados con algoritmo asimétrico RS256 y gestionados por Keycloak. | M |
| RNF-003 | El token de acceso debe vivir exclusivamente en memoria del cliente (JavaScript runtime); no debe persistirse en localStorage, sessionStorage ni cookies. | M |
| RNF-004 | Los secretos de configuración (credenciales de BD, claves de Keycloak, etc.) deben gestionarse mediante variables de entorno y nunca estar hardcodeados en el código fuente ni en el repositorio. | M |
| RNF-005 | El backend debe validar y sanitizar todas las entradas del usuario para prevenir inyecciones SQL, XSS y otros vectores del OWASP Top 10. | M |
| RNF-006 | Las contraseñas de usuarios deben almacenarse hasheadas con bcrypt, delegando este proceso a Keycloak. | M |
| RNF-007 | Las políticas de CORS del backend deben restringir los orígenes permitidos a los dominios del frontend en producción. | M |

---

### 2.2 Disponibilidad y redundancia

| ID | Requerimiento | Prioridad |
|---|---|---|
| RNF-010 | El frontend debe desplegarse en dos instancias independientes para garantizar disponibilidad ante la caída de una de ellas. | M |
| RNF-011 | El sistema debe permanecer funcional ante la caída de una instancia de frontend sin intervención manual. | S |

---

### 2.3 Rendimiento

| ID | Requerimiento | Prioridad |
|---|---|---|
| RNF-020 | El tiempo de respuesta del análisis completo (desde la carga del archivo hasta la presentación de resultados) no debe superar los 30 segundos en condiciones normales de operación. | S |
| RNF-021 | Las páginas del frontend deben cargar en menos de 3 segundos en una conexión de red estándar. | S |
| RNF-022 | El servicio de ML debe responder a una solicitud de inferencia en menos de 15 segundos. | S |

---

### 2.4 Usabilidad y accesibilidad

| ID | Requerimiento | Prioridad |l
|---|---|---|
| RNF-030 | El sistema debe presentar vistas y funcionalidades distintas según el rol del usuario autenticado: el Usuario normal accede únicamente al análisis por link de YouTube; el Productor musical accede además a la carga de archivo MP3 | M |
| RNF-031 | El menú de navegación lateral debe adaptarse dinámicamente al rol, mostrando únicamente las opciones relevantes para cada perfil | M |
| RNF-032 | El sistema debe implementar guardas de ruta que redirijan automáticamente al usuario a su panel correspondiente si intenta acceder a una ruta de otro rol. | M |
| RNF-033 | El menú lateral debe colapsar en pantallas pequeñas y ser accesible mediante un botón hamburguesa con scrim de cierre.| M |
| RNF-034 | El sistema debe mostrar una pantalla de carga con indicador de progreso y mensajes rotativos mientras se procesa el análisis. | M |
| RNF-035 | Los mensajes de error deben ser claros y orientados al usuario, sin exponer detalles técnicos internos del sistema. | M |

---

### 2.5 Base de datos

| ID | Requerimiento | Prioridad |
|---|---|---|
| RNF-040 | El esquema de la base de datos debe cumplir mínimo la Tercera Forma Normal (3FN), documentando y justificando cada tabla y relación. | M |
| RNF-041 | PostgreSQL es el único sistema gestor de base de datos relacional permitido para el almacenamiento de datos del sistema. | M |
| RNF-042 | La base de datos debe definir claves primarias, foráneas y restricciones de integridad referencial para todas las relaciones entre entidades. | M |

---

### 2.6 Mantenibilidad y documentación

| ID | Requerimiento | Prioridad |
|---|---|---|
| RNF-050 | El código fuente debe estar organizado por capas o módulos claramente separados (frontend, backend, ML service), con estructura de carpetas consistente. | M |
| RNF-051 | La API del backend debe estar documentada en formato OpenAPI/Swagger, con descripción de cada endpoint, parámetros, payloads y respuestas. | M |
| RNF-052 | Los archivos de configuración de infraestructura (Dockerfiles, docker-compose) deben estar comentados y explicar las decisiones de configuración relevantes. | M |
| RNF-053 | El sistema debe contar con un manual de usuario diferenciado por rol (Productor musical / Usuario normal). | M |

---

### 2.7 Infraestructura y despliegue

| ID | Requerimiento | Prioridad |
|---|---|---|
| RNF-060 | El sistema completo debe poder desplegarse mediante Docker y docker-compose, sin dependencias de entorno manual no documentadas. | M |
| RNF-061 | El despliegue debe realizarse exclusivamente en la nube privada institucional; no se utilizan servicios de nube pública. | M |
| RNF-062 | La topología de red del despliegue debe estar documentada, incluyendo VLANs, subredes, zonas y reglas de firewall. | M |

---

