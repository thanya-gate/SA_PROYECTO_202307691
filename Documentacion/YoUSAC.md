# Proyecto YoUSAC

## Índice
1. [Introducción](#introducción)
2. [Descripción del problema](#descripción-del-problema)
3. [Alcance del sistema](#alcance-del-sistema)
   - 3.1 [Alcance de Fase 2](#alcance-de-fase-2)
4. [Requerimientos del sistema](#requerimientos-del-sistema)
   - 4.1 [Requerimientos Funcionales (RF)](#requerimientos-funcionales-rf)
   - 4.2 [Requerimientos No Funcionales (RNF)](#requerimientos-no-funcionales-rnf)
   - 4.3 [Trazabilidad y estado de implementación](#trazabilidad-y-estado-de-implementación)
5. [Modelo de Casos de Uso](#modelo-de-casos-de-uso)
   - 5.1 [Diagrama de alto nivel](#diagrama-de-alto-nivel)
   - 5.2 [Descomposición por módulo](#descomposición-por-módulo)
   - 5.3 [Casos de uso expandidos](#casos-de-uso-expandidos)
6. [Vista de Arquitectura (Modelo 4+1)](#vista-de-arquitectura-modelo-41)
   - 6.1 [Vista de Escenarios](#vista-de-escenarios)
   - 6.2 [Vista Lógica](#vista-lógica)
   - 6.3 [Vista de Procesos](#vista-de-procesos)
   - 6.4 [Vista de Componentes](#vista-de-componentes)
   - 6.5 [Vista de Despliegue](#vista-de-despliegue)
7. [Diseño del Modelado de Datos (DER)](#diseño-del-modelado-de-datos-der)
8. [Diseño UI/UX (Mockups)](#diseño-uiux-mockups)
9. [Conclusión](#conclusion)
---

## Introducción
El presente documento describe el análisis, diseño y planificación de la arquitectura del proyecto YoUSAC, una plataforma web de video bajo demanda (VOD) orientada al entorno universitario. Su principal objetivo es centralizar el acceso a las grabaciones de clases impartidas en semestres anteriores, permitiendo a los estudiantes consultar contenido académico, reforzar conocimientos y dar continuidad a su proceso de aprendizaje mediante una experiencia de navegación eficiente y segura.

Para satisfacer los requerimientos de escalabilidad, disponibilidad y alto rendimiento, el sistema se desarrolla siguiendo una arquitectura de microservicios políglota, distribuyendo las responsabilidades entre servicios implementados en Go, TypeScript y Python, cada uno especializado en un dominio específico del negocio. La comunicación entre los microservicios se realiza mediante gRPC y contratos definidos con Protocol Buffers, mientras que el acceso desde el cliente web se centraliza a través de un API Gateway, garantizando un punto de entrada único y seguro.

Asimismo, la solución incorpora mecanismos modernos de autenticación y autorización utilizando JWT, Session Cookies y OAuth 2.0, además de aplicar el patrón Database per Microservice, almacenamiento en caché con Redis, contenedores Docker y despliegue en Google Cloud Platform (GCP). Estas tecnologías permiten construir una plataforma desacoplada, mantenible y preparada para soportar un gran número de usuarios concurrentes.

## Descripción del problema
La Universidad San Carlos de Guatemala crear un sistema para centralizar el acceso a su acervo académico digital mediante una plataforma web de streaming de video bajo demanda (VOD) orientada al entorno universitario. El sistema permitirá a los estudiantes explorar, buscar y visualizar las grabaciones de las clases impartidas en semestres anteriores, facilitando el repaso de contenidos de cara a exámenes, laboratorios y autoformación.

Dado el elevado número de estudiantes conectados de forma concurrente en
periodos de evaluaciones y el volumen de contenido multimedia administrado, la
plataforma debe ser altamente escalable, tolerante a fallos y ofrecer bajos tiempos
de respuesta. Para maximizar el rendimiento y aprovechar las fortalezas específicas
de distintos lenguajes de programación, el departamento de ingeniería ha
determinado construir el sistema bajo una Arquitectura de Microservicios
Políglota.
De forma obligatoria, el backend implementará tres (3) lenguajes de programación
en simultáneo: Go, TypeScript y Python, distribuidos estratégicamente según el
dominio de cada microservicio.

TypeScript (Auth/Catálogo)
Go (Reproducción/Checkpoints)
Python (Analítica)

Toda la comunicación interna entre microservicios (east-west traffic) se realizará
mediante el protocolo síncrono gRPC sobre HTTP/2 con contratos estrictos Protocol
Buffers (.proto). La exposición externa de los servicios hacia el cliente web
(north-south traffic) se centralizará a través de un API Gateway.

La gestión de identidades se garantizará mediante JWT (JSON Web Tokens),
Session Cookies seguras y soporte para autorización delegada vía OAuth 2.0.
Asimismo, la persistencia seguirá el patrón Database per Microservice, integrando
lógica de datos programable en el motor de base de datos (procedimientos
almacenados, vistas, funciones y triggers).

## Alcance del sistema
1. Autenticación, Gestión de Sesiones y Multiperfil
2. Gestión de Inscripción y permisos
3. Catálogo, Búsqueda y Detalle de contenido
4. Servicio de Analítica, Tendencias y Recomendaciones
5. Historial de Reproducción Reciente y Checkpoint de Avance
6. Sistema de notificaciones por Correo

### Alcance de Fase 2

La Fase 2 documenta la evolución de YoUSAC hacia una plataforma de aprendizaje
interactivo y una operación cloud-native. Sobre las capacidades de Fase 1, el
alcance objetivo incorpora:

1. Foro de dudas asociado al timestamp del video, con marcadores en la barra de
   reproducción, respuestas y verificación de respuestas.
2. Cuaderno de apuntes en Markdown, con referencias de tiempo, persistencia por
   estudiante y exportación a `.md` o PDF.
3. Segmentación de grabaciones por capítulos y temas, con gestión para
   catedráticos/auxiliares y navegación desde el reproductor.
4. Repositorio de materiales adjuntos y recursos de laboratorio, con carga,
   consulta, descarga, versionado, métricas y validación de archivos.
5. Playlists de repaso creadas por estudiantes, combinando clases o fragmentos y
   con visibilidad privada o pública mediante un enlace compartible.
6. Infraestructura de producción en Kubernetes/GKE con Ingress, servicios
   internos `ClusterIP`, health checks, límites de recursos, persistencia,
   Container Registry y pipeline CI/CD.

El alcance funcional y técnico se toma del [enunciado oficial del Proyecto Fase
2](../context/proyecto2.md). La [Práctica 4](../context/practica4.md) define el
hito inicial de documentación, capítulos, materiales y pruebas base; las
[aclaraciones de clase](../context/aclaraciones_practica4_fase2.md) complementan
las restricciones de Kubernetes, secretos, persistencia, CI/CD y trabajo por
Pull Request. Este alcance objetivo no implica que todas las capacidades estén
implementadas en el baseline actual; su estado se detalla en la trazabilidad.

## Requerimientos del sistema
### Requerimientos Funcionales (RF)

| ID | Requerimiento | Descripción | Prioridad |
|---|---|---|---|
| RF-01 | Autenticación institucional exclusiva | El sistema debe permitir registro y acceso únicamente con correo institucional de la Facultad de Ingeniería (@ingenieria.usac.edu.gt / @ing.usac.edu.gt) | Alta |
| RF-02 | Rechazo de correos personales/comerciales | El sistema debe rechazar el acceso con correos personales y comerciales (gmail, hotmail, etc.) | Alta |
| RF-03 | Gestión de sesiones (JWT + Session Cookies) | El sistema debe emitir y validar sesiones mediante JWT y Session Cookies (HttpOnly y Secure) | Alta |
| RF-04 | Login mediante OAuth 2.0 institucional | El sistema debe soportar login mediante OAuth 2.0 institucional | Media |
| RF-05 | Consulta de cursos, matrícula y credenciales | El sistema debe permitir al estudiante consultar sus cursos asignados/inscritos por semestre, el estado de su matriculación y credenciales académicas | Alta |
| RF-06 | Control de acceso basado en roles (RBAC) | El sistema debe controlar el acceso según rol correspondiente (RBAC): Estudiante, Catedrático/Docente, Auxiliar y Administrador | Alta |
| RF-07 | Búsqueda avanzada y filtrado de grabaciones | El sistema debe permitir una búsqueda avanzada y filtrado de grabaciones por Semestre/Año, Escuela, Curso, Catedrático y Temas | Alta |
| RF-08 | Vista detallada / ficha técnica de la clase | El sistema debe mostrar una vista detallada de la clase grabada con su respectiva ficha técnica de cada clase (unidad, fecha, sílabo/material adjunto, docentes/auxiliares) | Media |
| RF-09 | Cálculo de porcentaje de recomendación | El sistema debe calcular y mostrar el porcentaje de recomendación de una clase según valoraciones | Media |
| RF-10 | Registro de checkpoint de reproducción | El sistema debe guardar el checkpoint exacto donde el estudiante detuvo el video | Alta |
| RF-11 | Reanudación desde el último checkpoint | El sistema debe reanudar la reproducción desde el último checkpoint guardado | Alta |
| RF-12 | Cálculo de clases más vistas y mejor valoradas | El sistema debe calcular las clases más vistas por semana y el ranking de mejor valoradas | Media |
| RF-13 | Caché de consultas frecuentes (Redis) | El sistema debe cachear en Redis las consultas frecuentes de catálogo y tendencias | Media |
| RF-14 | Notificaciones automáticas por correo | El sistema debe enviar correos automáticos de confirmación de registro y de nuevas clases publicadas | Alta |
| RF-15 | Carga masiva de catálogo vía CSV | El sistema debe permitir la carga masiva de contenido/metadata del catálogo mediante archivos CSV | Media |
| RF-16 | Foro de dudas anclado al timestamp | El sistema debe permitir crear preguntas asociadas al segundo actual del video, mostrar marcadores en la barra de reproducción, admitir respuestas y marcar una respuesta como correcta/verificada | Alta |
| RF-17 | Cuaderno de apuntes Markdown sincronizado | El sistema debe permitir redactar y guardar apuntes Markdown ligados al estudiante, insertar marcas de tiempo que permitan saltar en el reproductor y exportar los apuntes a `.md` o PDF | Alta |
| RF-18 | Gestión de capítulos y temas | El sistema debe permitir a catedráticos y auxiliares crear, editar, eliminar y ordenar capítulos, navegar por ellos desde el reproductor y validar timestamps enteros, no negativos, dentro de la duración, sin solapamientos ni órdenes duplicados | Alta |
| RF-19 | Repositorio de material adjunto | El sistema debe permitir cargar, consultar, descargar y versionar materiales asociados a una clase, registrar sus métricas de descarga y validar MIME/extensión, nombre sanitizado y límite de 50 MB | Alta |
| RF-20 | Playlists de repaso | El sistema debe permitir crear, nombrar y organizar playlists con grabaciones o fragmentos de distintos cursos/semestres, configurándolas como privadas o públicas mediante un enlace compartible | Media |

### Requerimientos No Funcionales (RNF)
| ID | Atributo de calidad | Especificación cuantitativa | Prioridad |
|---|---|---|---|
| RNF-01 | Rendimiento | El 95% de las peticiones al API Gateway deben responder en menos de 300ms | Alta |
| RNF-02 | Escalabilidad | La capacidad se validará con una prueba de carga de al menos 100 estudiantes concurrentes durante 10 minutos, conservando RNF-01 y una tasa de errores HTTP ≤ 1%; los servicios de producción deben poder escalar horizontalmente | Alta |
| RNF-03 | Disponibilidad | El sistema debe mantener una disponibilidad mensual mínima de 99% en producción, excluyendo ventanas de mantenimiento anunciadas | Media |
| RNF-04 | Seguridad | Toda comunicación cliente-servidor debe usar HTTPS/TLS | Alta |
| RNF-05 | Seguridad | Las contraseñas/tokens no deben almacenarse en texto plano, debe usarse JWT con expiración ≤ 10 min | Alta |
| RNF-06 | Comunicación interna | El 100% del tráfico east-west entre microservicios debe usar gRPC | Alta |
| RNF-07 | Caché | Las consultas de catálogo/tendencias cacheadas deben tener TTL ≤ 10 minutos | Media |
| RNF-08 | Mantenibilidad | El código debe seguir principios SOLID y cada microservicio debe alcanzar una cobertura de líneas de pruebas automatizadas ≥ 80% reportada por CI | Media |
| RNF-09 | Portabilidad | El sistema debe desplegarse mediante Docker Compose en entorno local y en la nube sin cambios de código | Alta |
| RNF-10 | Despliegue | El despliegue se debe realizar de forma obligatoria en Google Cloud Platform | Alta |
| RNF-11 | Exposición de servicios | En producción, el 100% del tráfico externo debe ingresar por Ingress; los servicios internos deben ser `ClusterIP` y deben existir 0 Services de tipo `NodePort` o `LoadBalancer` | Alta |
| RNF-12 | Salud de los despliegues | El 100% de los Deployments debe declarar y superar probes de liveness y readiness antes de recibir tráfico | Alta |
| RNF-13 | Recursos y persistencia | El 100% de los Deployments debe declarar requests y limits de CPU y memoria; PostgreSQL y Redis deben ejecutarse fuera de pods efímeros o contar con persistencia configurada | Alta |
| RNF-14 | Integración y entrega continua | En cada Pull Request y push a ramas principales deben ejecutarse las pruebas automatizadas; una falla debe detener build, publicación y despliegue | Alta |
| RNF-15 | Imágenes y Registry | El 100% de las imágenes debe ser construido por CI/CD, publicado en un Container Registry y etiquetado con una versión semántica; `latest` no debe ser la única referencia | Alta |
| RNF-16 | Gestión de secretos | Debe existir 0 secretos en texto plano dentro del repositorio, Dockerfiles o manifiestos; las credenciales deben inyectarse mediante configuración segura | Alta |
| RNF-17 | Carga segura de materiales | El 100% de las cargas debe pasar MIME/extensión permitidos, nombre sanitizado y tamaño entre 1 byte y 50 MB | Alta |
| RNF-18 | Integridad de capítulos | El 100% de los capítulos debe usar timestamps enteros no negativos, con fin mayor que inicio, dentro de la duración, sin solapamientos ni órdenes duplicados por clase | Alta |

### Trazabilidad y estado de implementación

La siguiente matriz separa el alcance oficial de la evidencia disponible en el
repositorio. **Integrado** significa que existe un flujo en código y pruebas
asociadas; no equivale por sí solo a una demostración en producción cloud.
**Pendiente/no evidenciado** significa que no se encontró implementación o
evidencia suficiente para afirmar cumplimiento.

| ID | Fuente oficial | Evidencia actual | Estado |
|---|---|---|---|
| RF-16 | [Proyecto Fase 2](../context/proyecto2.md), foro de dudas | No se encontraron entidades, rutas HTTP, RPC, componentes ni pruebas del foro de dudas anclado a timestamps | Pendiente/no evidenciado |
| RF-17 | [Proyecto Fase 2](../context/proyecto2.md), cuaderno Markdown | No se encontraron editor, persistencia de apuntes, navegación por timestamps ni exportación implementados | Pendiente/no evidenciado |
| RF-18 | [Proyecto Fase 2](../context/proyecto2.md) y [Práctica 4](../context/practica4.md), capítulos | [Contrato gRPC](../Backend/proto/catalogo.proto), [validadores](../Backend/services/catalog-service/src/application/dto/catalog-schemas.ts), [servicio](../Backend/services/catalog-service/src/application/services/catalog.service.ts), [SQL](../Backend/sql/catalogo.sql), [gestor](../Frontend/src/components/ChapterManager.tsx), [navegación](../Frontend/src/components/ChapterTimeline.tsx) y pruebas en [Catálogo](../Backend/services/catalog-service/tests/catalog-service.test.ts), [contrato SQL](../Backend/services/catalog-service/tests/catalogo-contract.sql) y [Frontend](../Frontend/tests/chapter-components.test.tsx) | Integrado en el baseline; respaldado por código y pruebas |
| RF-19 | [Proyecto Fase 2](../context/proyecto2.md) y [Práctica 4](../context/practica4.md), materiales | [Rutas del Gateway](../Backend/api-gateway/src/server.ts), [validación MIME/extensión/tamaño](../Backend/api-gateway/src/validation/material.ts), [almacenamiento y versionado](../Backend/api-gateway/src/storage/storage.ts), [contrato gRPC](../Backend/proto/catalogo.proto), [persistencia SQL](../Backend/sql/catalogo.sql), [panel](../Frontend/src/components/MaterialesPanel.tsx) y pruebas de [Gateway](../Backend/api-gateway/tests/gateway-materials.test.ts), [validación](../Backend/api-gateway/tests/material-validation.test.ts), [storage](../Backend/api-gateway/tests/storage.test.ts), [GCS](../Backend/api-gateway/tests/gcs-storage.test.ts), [Catálogo](../Backend/services/catalog-service/tests/postgres-catalog-repository.test.ts) y [Frontend](../Frontend/tests/materiales-api.test.ts) | Integrado en el baseline; respaldado por código y pruebas |
| RF-20 | [Proyecto Fase 2](../context/proyecto2.md), playlists | No se encontraron modelo de datos, endpoints, componentes ni pruebas de playlists privadas/públicas | Pendiente/no evidenciado |
| RNF-11 | [Proyecto Fase 2](../context/proyecto2.md) y [aclaraciones](../context/aclaraciones_practica4_fase2.md), Kubernetes | No existe directorio `k8s/` ni manifiestos que evidencien Ingress, `ClusterIP` o ausencia de `NodePort`/`LoadBalancer` | Pendiente/no evidenciado |
| RNF-12 | [Proyecto Fase 2](../context/proyecto2.md) y [aclaraciones](../context/aclaraciones_practica4_fase2.md), health checks | No existen Deployments Kubernetes con probes; los healthchecks de Docker Compose no sustituyen liveness/readiness de Kubernetes | Pendiente/no evidenciado |
| RNF-13 | [Proyecto Fase 2](../context/proyecto2.md) y [aclaraciones](../context/aclaraciones_practica4_fase2.md), recursos/persistencia | No existen manifiestos Kubernetes con requests/limits ni configuración productiva de persistencia para PostgreSQL y Redis | Pendiente/no evidenciado |
| RNF-14 | [Proyecto Fase 2](../context/proyecto2.md) y [aclaraciones](../context/aclaraciones_practica4_fase2.md), CI/CD | No existe `.github/workflows/` ni `.gitlab-ci.yml` que ejecute pruebas y bloquee las etapas posteriores | Pendiente/no evidenciado |
| RNF-15 | [Proyecto Fase 2](../context/proyecto2.md), Container Registry | Existen Dockerfiles, pero no hay pipeline ni evidencia de publicación/versionado de imágenes en un Registry | Pendiente/no evidenciado |
| RNF-16 | [Proyecto Fase 2](../context/proyecto2.md) y [aclaraciones](../context/aclaraciones_practica4_fase2.md), secretos | No hay auditoría de producción que demuestre cero secretos; los valores por defecto de desarrollo documentados en Compose/contexto no constituyen cumplimiento productivo | Pendiente/no evidenciado |
| RNF-17 | [Proyecto Fase 2](../context/proyecto2.md) y [Práctica 4](../context/practica4.md), validación de materiales | [Gateway](../Backend/api-gateway/src/validation/material.ts), [API frontend](../Frontend/src/api/materiales.ts) y pruebas de MIME, extensión, nombres y 50 MB | Integrado en el flujo actual; la medición del 100% en producción aún no está evidenciada |
| RNF-18 | [Proyecto Fase 2](../context/proyecto2.md) y [Práctica 4](../context/practica4.md), validación de capítulos | [DTO TypeScript](../Backend/services/catalog-service/src/application/dto/catalog-schemas.ts), [restricciones/procedimientos SQL](../Backend/sql/catalogo.sql), validación frontend y pruebas de [Catálogo](../Backend/services/catalog-service/tests/catalog-service.test.ts), [SQL](../Backend/services/catalog-service/tests/catalogo-contract.sql) y [Frontend](../Frontend/tests/chapter-components.test.tsx) | Integrado en el flujo actual; respaldado por código y pruebas |

Existe una discrepancia con el [estado local de contexto](../context/ESTADO_FASE2_Y_ENTORNO_LOCAL.md), que conserva un diagnóstico anterior donde capítulos y repositorio de materiales aparecen como pendientes. Para este documento se prioriza la evidencia actual de código y pruebas: esas dos capacidades están integradas en el baseline, mientras que foro, apuntes, playlists y los entregables cloud-native siguen pendientes según la matriz.

Los mockups y DER de Fase 2 son artefactos de diseño y no constituyen evidencia
de implementación por sí mismos. Entre ellos se encuentran los mockups de
[anotaciones](Mockups/MockupsF2_Anotaciones_G%234.drawio.svg), [foro de
dudas](Mockups/MockupsF2_ForoDudas_G%234.drawio.svg), [playlists](Mockups/MockupsF2_GestionPlaylists_G%234.drawio.svg) y
[segmentación](Mockups/MockupsF2_SegmentacionCapitulos_G%234.drawio.svg), además
de los [DER Fase 2 del Catálogo](ER/DER_MicroservicioCatalogo_F2_G%234.drawio.svg),
[Auth](ER/DER_MicroservicioAuth_F2_G%234.drawio.svg),
[Inscripción](ER/DER_MicroservicioInscripcion_F2_G%234.drawio.svg),
[Notificaciones](ER/DER_MicroservicioNotificaciones_F2_G%234.drawio.svg),
[Reproducción](ER/DER_MicroservicioReproduccion_F2_G%234.drawio.svg) y
[Analítica](ER/DER_MicroservicioAnalitica_F2_G%234.drawio.svg). La ejecución de
las suites relacionadas está descrita en [TESTING.md](TESTING.md); para
Kubernetes, CI/CD y Registry todavía no hay evidencia ejecutable en este
repositorio.

## Modelo de Casos de Uso
 
### Diagrama de alto nivel
![Diagrama alto nivel](CDU/CDU_AltoNivel_202307691.drawio.svg)

### Primera Descomposición General

![Diagrama primera descomposición](CDU/CDU_PrimeraDescomposicion_202307691.drawio.svg)

### Primera Descomposición por módulo
#### Módulo de Autenticación
![Diagrama primera descomposición módulo 1](CDU/CDU_PrimeraDescomposicion_M1_202307691.drawio.svg)

#### Módulo de Inscripciones
![Diagrama primera descomposición módulo 2](CDU/CDU_PrimeraDescomposicion_M2_202307691.drawio.svg)

#### Módulo de Contenido
![Diagrama primera descomposición módulo 3](CDU/CDU_PrimeraDescomposicion_M3_202307691.drawio.svg)

#### Módulo de Métricas
![Diagrama primera descomposición módulo 4](CDU/CDU_PrimeraDescomposicion_M4_202307691.drawio.svg)

#### Módulo de Reproducción
![Diagrama primera descomposición módulo 5](CDU/CDU_PrimeraDescomposicion_M5_202307691.drawio.svg)

#### Módulo de Notificaciones
![Diagrama primera descomposición módulo 6](CDU/CDU_PrimeraDescomposicion_M6_202307691.drawio.svg)

# Casos de uso expandidos
## Módulo 1: Autenticación, Gestión de Sesiones y Multiperfil

![Diagrama expandido módulo 1](CDU/CDU_Expandido_M1_202307691.drawio.svg)
---
 
### CDU0001.1: Autenticar usuario institucional
![CDU1](CDU/CDU_Expandido_CDU1_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0001.1 |
| Nombre | Iniciar sesión con correo institucional |
| Actor | Estudiante, Docente, Auxiliar, Administrador |
| Descripción | Permite a usuarios con correo institucional autenticarse en la plataforma, estableciendo una sesión segura. |
| Precondiciones | El usuario ya debe tener una cuenta registrada. |
| Postcondiciones | El usuario tiene una sesión activa con su rol identificado. |
 
**Flujo principal:**
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Accede a la pantalla de login. |
| 2 | Usuario | Ingresa correo institucional y contraseña. |
| 3 | Sistema | Validar que se tenga un dominio institucional. |
| 4 | Sistema | Valida las credenciales contra la base de datos. |
| 5 | Sistema | Genera un JWT y una Session Cookie. |
| 6 | Sistema | Redirige al usuario al catálogo principal según su rol. |
 
**Flujos alternativos:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| FA-01 | El usuario elige ingresar con cuenta institucional usando el servicio OAuth | El sistema extiende hace la validación con el proveedor y se sigue el flujo principal desde el paso 5. |
 
**Flujos de excepción:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El correo no pertenece al dominio institucional | El sistema rechaza el intento y muestra "Correo no autorizado". |
| FE-02 | La contraseña no coincide | El sistema incrementa el contador de intentos fallidos y muestra "Credenciales incorrectas". |
 
---
 
### CDU0001.2: Validar dominio institucional

![CDU2](CDU/CDU_Expandido_CDU2_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0001.2 |
| Nombre | Validar dominio institucional |
| Actor | include |
| Descripción | Verifica que el correo ingresado pertenezca al dominio autorizado de la Facultad de Ingeniería. |
| Precondiciones | Se recibió un correo electrónico como parte de un login o registro. |
| Postcondiciones | Se confirma o rechaza la validez del dominio del correo. |
 
**Flujo principal:**
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Recibe el correo electrónico a validar. |
| 2 | Sistema | Compara el dominio permitido con el ingresado. |
| 3 | Sistema | Retorna "dominio válido" al caso de uso que lo invocó. |
 
**Flujos alternativos:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
**Flujos de excepción:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El dominio no está autorizado | El sistema retorna "dominio inválido" y el caso de uso invocador aborta el flujo. |
 
---
 
### CDU0001.3: Autenticarse vía OAuth institucional
 
![CDU3](CDU/CDU_Expandido_CDU3_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0001.3 |
| Nombre | Autenticarse vía OAuth institucional |
| Actor | Estudiante, Docente, Auxiliar, Administrador, OAuth Institucional |
| Descripción | Ruta alternativa (extend) de autenticación delegando la verificación de identidad al proveedor OAuth institucional. |
| Precondiciones | El usuario cuenta con una identidad federada en el sistema OAuth de la universidad. |
| Postcondiciones | El usuario queda autenticado mediante identidad federada. |
 
**Flujo principal:**
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Selecciona "Ingresar con cuenta institucional" en el login. |
| 2 | Sistema | Redirige al usuario al proveedor OAuth institucional. |
| 3 | Usuario | Se autentica en el proveedor OAuth. |
| 4 | OAuth Institucional | Retorna un token de identidad al sistema. |
| 5 | Sistema | Valida el token y continúa el flujo de principal desde su paso 5. |
 
**Flujos alternativos:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
**Flujos de excepción:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El usuario cancela o falla la autenticación en el proveedor | El sistema retorna al login mostrando "No se pudo completar el inicio de sesión". |
| FE-02 | El token recibido es inválido o expiró | El sistema rechaza el intento y solicita reintentar. |
 
---
 
### CDU0001.4: Registrar cuenta nueva

![CDU4](CDU/CDU_Expandido_CDU4_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0001.4 |
| Nombre | Registrar cuenta nueva |
| Actor | Estudiante, Docente/Catedrático, Auxiliar, Microservicio de Notificaciones |
| Descripción | Permite a un usuario con correo institucional crear su cuenta por primera vez en la plataforma. |
| Precondiciones | El usuario no tiene una cuenta previamente creada. |
| Postcondiciones | Se crea una nueva cuenta de usuario y se notifica por correo. |
 
**Flujo principal:**
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Accede a la pantalla de registro. |
| 2 | Usuario | Ingresa su correo institucional y define una contraseña. |
| 3 | Sistema | Ejecuta CDU0001.2 (Validar dominio institucional). |
| 4 | Sistema | Crea el registro de usuario con rol por defecto (Estudiante). |
| 5 | Sistema | Dispara un evento hacia el Microservicio de Notificaciones para enviar el correo de confirmación de registro. |
| 6 | Sistema | Redirige al usuario al login. |
 
**Flujos alternativos:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
**Flujos de excepción:**
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El correo no pertenece al dominio institucional | El registro se rechaza mostrando "Correo no autorizado". |
| FE-02 | El correo ya está registrado | El sistema muestra "Ya existe una cuenta con este correo" y sugiere iniciar sesión. |
 
---
## Módulo 2: Gestión de Inscripción y Permisos
 
![Diagrama expandido módulo 2](CDU/CDU_Expandido_M2_202307691.drawio.svg)
 
---
 
### CDU0002.1: Consultar cursos asignados/inscritos
 
![CDU5](CDU/CDU_Expandido_CDU5_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0002.1 |
| Nombre | Consultar cursos asignados/inscritos |
| Actor | Estudiante, Docente/Catedrático, Auxiliar |
| Descripción | Permite a cualquier usuario institucional consultar los cursos en los que está inscrito o asignado durante el semestre vigente. |
| Precondiciones | El usuario tiene una sesión activa. |
| Postcondiciones | Se muestra al usuario el listado de cursos correspondiente a su rol. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Accede al panel de cursos/asignaciones. |
| 2 | Sistema | Identifica el rol del usuario mediante el Microservicio de Autenticación. |
| 3 | Sistema | Ejecuta consultar estado de matriculación. |
| 4 | Sistema | Muestra el listado de cursos según el rol. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El usuario no tiene cursos registrados para el semestre vigente | El sistema muestra "No hay cursos asociados a tu cuenta este semestre". |
| FE-02 | Error de comunicación con el Microservicio de Autenticación | El sistema muestra un mensaje de error genérico y solicita reintentar. |
 
---
 
### CDU0002.2: Consultar estado de matriculación
 
![CDU6](CDU/CDU_Expandido_CDU6_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0002.2 |
| Nombre | Consultar estado de matriculación |
| Actor | include |
| Descripción | Verifica y retorna el estado de matriculación vigente del usuario (activo, pendiente, cerrado). |
| Precondiciones | El usuario ya fue identificado por rol. |
| Postcondiciones | Se retorna el estado de matriculación al caso de uso que lo invocó. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Consulta la base de datos de matriculación del usuario. |
| 2 | Sistema | Retorna el estado vigente. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| — | Ninguno | — |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | No existe registro de matriculación | El sistema retorna "sin matrícula" al caso de uso invocador. |
 
---
 
### CDU0002.3: Gestionar control de acceso por roles (RBAC)
 
![CDU7](CDU/CDU_Expandido_CDU7_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0002.3 |
| Nombre | Gestionar control de acceso por roles (RBAC) |
| Actor | Administrador |
| Descripción | Permite al administrador visualizar y administrar los roles existentes en la plataforma (Estudiante, Docente/Catedrático, Auxiliar, Administrador). |
| Precondiciones | El administrador tiene una sesión activa. |
| Postcondiciones | El administrador puede ver y gestionar los roles del sistema. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Administrador | Accede al panel de gestión de roles. |
| 2 | Sistema | Muestra el listado de usuarios con su rol actual. |
| 3 | Administrador | Selecciona un usuario para modificar su rol. |
| 4 | Sistema | Ejecuta asignar/editar rol de usuario. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El administrador no tiene permisos suficientes | El sistema muestra "Acceso denegado". |
 
---
 
### CDU0002.4: Asignar/editar rol de usuario
 
![CDU8](CDU/CDU_Expandido_CDU8_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0002.4 |
| Nombre | Asignar/editar rol de usuario |
| Actor | Administrador |
| Descripción | Permite modificar el rol asignado a un usuario específico dentro del sistema. |
| Precondiciones | El usuario a modificar existe en el sistema. |
| Postcondiciones | El rol del usuario queda actualizado. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Administrador | Selecciona el nuevo rol para el usuario. |
| 2 | Sistema | Actualiza el rol del usuario en la base de datos. |
| 3 | Sistema | Ejecuta auditar cambio de permisos. |
| 4 | Sistema | Confirma el cambio al administrador. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El rol seleccionado no es válido | El sistema rechaza el cambio y muestra "Rol inválido". |
 
---
 
### CDU0002.5: Auditar cambio de permisos
 
![CDU9](CDU/CDU_Expandido_CDU9_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0002.5 |
| Nombre | Auditar cambio de permisos |
| Actor | ejecutado automáticamente como trigger de base de datos |
| Descripción | Registra en la bitácora de auditoría cada cambio de rol/permiso realizado sobre un usuario. |
| Precondiciones | Se realizó un cambio de rol. |
| Postcondiciones | Queda un registro de auditoría del cambio. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema (trigger) | Detecta el cambio de rol en la base de datos. |
| 2 | Sistema (trigger) | Inserta un registro de auditoría con el detalle del cambio. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | Falla la escritura del registro de auditoría | El sistema revierte el cambio de rol y notifica el error al administrador. |
 
---
## Módulo 3: Catálogo, Búsqueda y Detalle de Contenido

![Diagrama expandido módulo 3](CDU/CDU_Expandido_M3_202307691.drawio.svg)
---
 
### CDU0003.1: Buscar grabaciones

![CDU10](CDU/CDU_Expandido_CDU10_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0003.1 |
| Nombre | Buscar grabaciones |
| Actor | Estudiante, Docente, Auxiliar |
| Descripción | Permite a cualquier usuario institucional buscar grabaciones de clases dentro del catálogo académico. |
| Precondiciones | El usuario tiene una sesión activa. |
| Postcondiciones | Se muestra al usuario el listado de grabaciones que coinciden con la búsqueda. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Accede al catálogo de grabaciones. |
| 2 | Usuario | Ingresa un término de búsqueda o abre el panel de filtros. |
| 3 | Sistema | Ejecuta aplicar filtros de búsqueda. |
| 4 | Sistema | Muestra el listado de resultados. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FA-01 | El usuario selecciona un resultado del listado | El sistema extiende hacia ver ficha técnica de clase. |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | No hay resultados que coincidan con la búsqueda | El sistema muestra "No se encontraron grabaciones para tu búsqueda". |
| FE-02 | Error de comunicación con el catálogo | El sistema muestra un mensaje de error genérico y solicita reintentar. |
 
---
 
### CDU0003.2: Aplicar filtros de búsqueda

![CDU11](CDU/CDU_Expandido_CDU11_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0003.2 |
| Nombre | Aplicar filtros de búsqueda |
| Actor | include |
| Descripción | Filtra las grabaciones del catálogo por semestre/año, escuela/área, curso, catedrático y tema/etiqueta. |
| Precondiciones | Se recibió un criterio de búsqueda o filtro. |
| Postcondiciones | Se retorna el subconjunto de grabaciones que cumple los filtros. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Recibe los criterios de filtro seleccionados. |
| 2 | Sistema | Consulta la base de datos del catálogo aplicando los filtros. |
| 3 | Sistema | Retorna el listado filtrado al caso de uso invocador. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | Combinación de filtros inválida  | El sistema ignora el filtro inválido y aplica el resto. |
 
---
 
### CDU0003.3: Ver ficha técnica de clase

![CDU12](CDU/CDU_Expandido_CDU12_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0003.3 |
| Nombre | Ver ficha técnica de clase |
| Actor | Estudiante, Docente, Auxiliar |
| Descripción | Muestra el detalle de una grabación: unidad del programa, fecha de impartición, catedráticos/auxiliares participantes. |
| Precondiciones | El usuario seleccionó una grabación. |
| Postcondiciones | Se muestra la ficha técnica completa de la clase. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Selecciona una grabación del listado de resultados. |
| 2 | Sistema | Consulta los datos de la ficha técnica de la clase. |
| 3 | Sistema | Muestra la ficha técnica al usuario. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FA-01 | La clase tiene material adjunto | El sistema extiende hacia ver material adjunto. |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | La grabación ya no está disponible | El sistema muestra "Esta grabación ya no se encuentra disponible". |
 
---
 
### CDU0003.4: Ver material adjunto
 
![CDU13](CDU/CDU_Expandido_CDU13_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0003.4 |
| Nombre | Ver material adjunto |
| Actor | Estudiante, Docente, Auxiliar |
| Descripción | Permite consultar y descargar el material adjunto asociado a una clase grabada. |
| Precondiciones | La ficha técnica de la clase tiene material adjunto disponible. |
| Postcondiciones | El usuario visualiza o descarga el material adjunto. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Selecciona el material adjunto desde la ficha técnica. |
| 2 | Sistema | Recupera el archivo asociado. |
| 3 | Sistema | Muestra o descarga el archivo al usuario. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El archivo no se pudo recuperar | El sistema muestra "No se pudo cargar el material adjunto". |
 
---
 
### CDU0003.5: Notificar publicación de nueva clase
 
![CDU14](CDU/CDU_Expandido_CDU14_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0003.5 |
| Nombre | Notificar publicación de nueva clase |
| Actor | Microservicio de Notificaciones |
| Descripción | Cuando se agrega una nueva grabación al catálogo, dispara un evento hacia el Microservicio de Notificaciones para avisar a los estudiantes inscritos en el curso correspondiente. |
| Precondiciones | Se publicó una nueva grabación en el catálogo. |
| Postcondiciones | Los estudiantes inscritos reciben la notificación de la nueva clase disponible. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Detecta la publicación de una nueva grabación en el catálogo. |
| 2 | Sistema | Identifica a los estudiantes inscritos en el curso correspondiente. |
| 3 | Sistema | Dispara el evento hacia el Microservicio de Notificaciones. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | Falla la comunicación con el Microservicio de Notificaciones | El sistema registra el evento en una cola de reintentos. |
 
---

## Módulo 4: Analítica, Tendencias y Recomendaciones
 
 ![Diagrama expandido módulo 4](CDU/CDU_Expandido_M4_202307691.drawio.svg)

---
 ![CDU15](CDU/CDU_Expandido_CDU15_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0004.1 |
| Nombre | Consultar tendencias y ranking de clases |
| Actor | Estudiante, Administrador |
| Descripción | Permite consultar las clases más vistas por semana, los temas de mayor tendencia y el ranking de clases mejor valoradas. |
| Precondiciones | El usuario tiene una sesión activa. |
| Postcondiciones | Se muestra al usuario el listado de tendencias y ranking vigente. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Accede a la sección de tendencias. |
| 2 | Sistema | Ejecuta consultar caché de tendencias (Redis). |
| 3 | Sistema | Muestra el ranking y las tendencias vigentes. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | La caché no tiene datos vigentes  | El sistema recalcula las tendencias desde la base de datos y actualiza la caché. |
| FE-02 | Error de comunicación con Redis | El sistema muestra un mensaje de error genérico y solicita reintentar. |
 
---
 ![CDU16](CDU/CDU_Expandido_CDU16_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0004.2 |
| Nombre | Consultar caché de tendencias (Redis) |
| Actor | include |
| Descripción | Recupera desde Redis las consultas frecuentes de catálogo y tendencias, evitando sobrecargar la base de datos. |
| Precondiciones | Se solicitó una consulta de tendencias o recomendaciones. |
| Postcondiciones | Se retorna el dato solicitado desde la caché o se señala que expiró. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Consulta la clave correspondiente en Redis. |
| 2 | Sistema | Retorna el valor cacheado al caso de uso invocador. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | La clave no existe o expiró| El sistema retorna "caché vacía" al caso de uso invocador. |
 
---
 
![CDU17](CDU/CDU_Expandido_CDU17_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0004.3 |
| Nombre | Calificar clase |
| Actor | Estudiante |
| Descripción | Permite a un estudiante calificar una clase vista, alimentando el cálculo dinámico del ranking y las recomendaciones. |
| Precondiciones | El estudiante consultó la ficha técnica de la clase. |
| Postcondiciones | Se registra la calificación y se actualiza el porcentaje de recomendación de la clase. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Selecciona una puntuación desde la ficha técnica de la clase. |
| 2 | Sistema | Registra la calificación en la base de datos. |
| 3 | Sistema | Recalcula el porcentaje de recomendación de la clase. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FA-01 | El estudiante ya había calificado la clase | El sistema actualiza la calificación previa en lugar de crear una nueva. |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | Error al registrar la calificación | El sistema muestra un mensaje de error genérico y solicita reintentar. |
 
---
 
 ![CDU18](CDU/CDU_Expandido_CDU18_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0004.4 |
| Nombre | Calcular recomendaciones académicas |
| Actor | Microservicio de Reproducción |
| Descripción | Calcula dinámicamente un porcentaje de recomendación para cada clase, a partir del historial de reproducción y las calificaciones registradas. |
| Precondiciones | Existen datos de reproducción y/o calificaciones disponibles. |
| Postcondiciones | Se actualiza el porcentaje de recomendación de las clases procesadas. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Recibe los datos de reproducción/checkpoint desde el microservicio de historial. |
| 2 | Sistema | Ejecuta consultar caché de tendencias (Redis). |
| 3 | Sistema | Calcula el porcentaje de recomendación de cada clase. |
| 4 | Sistema | Actualiza los resultados en la base de datos y en la caché. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | No hay suficientes datos históricos para calcular la recomendación | El sistema asigna un valor por defecto y marca la clase como "sin suficiente información". |
 
---

## Módulo 5: Historial de Reproducción y Checkpoint de Avance
 
 ![Diagrama expandido módulo 5](CDU/CDU_Expandido_M5_202307691.drawio.svg)
 
---
 
![CDU19](CDU/CDU_Expandido_CDU19_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0005.1 |
| Nombre | Reproducir grabación |
| Actor | Estudiante |
| Descripción | Permite al estudiante reproducir el video de una clase grabada. |
| Precondiciones | El estudiante tiene una sesión activa. |
| Postcondiciones | El video se reproduce y el sistema comienza a registrar el avance. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Selecciona una grabación desde su ficha técnica. |
| 2 | Sistema | Carga el video y comienza la reproducción. |
| 3 | Sistema | Registra periódicamente el minuto exacto de avance. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FA-01 | El estudiante pausa o cierra el video antes de terminar | El sistema extiende hacia guardar checkpoint de avance. |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El video no se puede cargar | El sistema muestra "No se pudo cargar la grabación" y solicita reintentar. |
 
---
 
![CDU20](CDU/CDU_Expandido_CDU20_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0005.2 |
| Nombre | Guardar checkpoint de avance |
| Actor | include |
| Descripción | Almacena con precisión el semestre, curso, unidad, tema y segundo/minuto exacto donde el estudiante detuvo la reproducción. |
| Precondiciones | El estudiante estaba reproduciendo una grabación. |
| Postcondiciones | Queda registrado el punto exacto de avance para esa clase y ese estudiante. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Captura el punto exacto de reproducción. |
| 2 | Sistema | Almacena o actualiza el checkpoint asociado a la cuenta del estudiante. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | Falla el guardado del checkpoint | El sistema reintenta en segundo plano sin interrumpir al usuario. |
 
---
 
![CDU21](CDU/CDU_Expandido_CDU21_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0005.3 |
| Nombre | Reanudar reproducción |
| Actor | Estudiante |
| Descripción | Permite al estudiante continuar viendo una clase exactamente desde el punto donde la dejó. |
| Precondiciones | Existe un checkpoint previo guardado para esa clase y ese estudiante. |
| Postcondiciones | El video se reanuda desde el minuto exacto del checkpoint. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Selecciona una clase que ya había visto parcialmente. |
| 2 | Sistema | Ejecuta guardar checkpoint de avance para recuperar el último punto guardado. |
| 3 | Sistema | Reanuda la reproducción desde ese punto. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | No existe checkpoint previo para esa clase | El sistema inicia la reproducción desde el minuto 0. |
 
---
 
 ![CDU22](CDU/CDU_Expandido_CDU22_202307691.drawio.svg)

| Campo | Descripción |
|-------|-------------|
| ID | CDU0005.4 |
| Nombre | Consultar historial de reproducción reciente |
| Actor | Estudiante |
| Descripción | Muestra al estudiante el listado de clases vistas recientemente y su avance en cada una. |
| Precondiciones | El estudiante tiene una sesión activa. |
| Postcondiciones | Se muestra el historial reciente con el progreso de cada clase. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Usuario | Accede a la sección de historial reciente. |
| 2 | Sistema | Consulta los checkpoints más recientes del estudiante. |
| 3 | Sistema | Muestra el listado con el porcentaje de avance de cada clase. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El estudiante no tiene historial reciente | El sistema muestra "Aún no has visto ninguna clase". |
 
---

![CDU23](CDU/CDU_Expandido_CDU23_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0005.5 |
| Nombre | Enviar datos de checkpoint a analítica |
| Actor | Microservicio de Analítica |
| Descripción | Envía de forma periódica los datos de reproducción y checkpoints hacia el módulo de Analítica para el cálculo de tendencias y recomendaciones. |
| Precondiciones | Existen checkpoints nuevos o actualizados desde la última sincronización. |
| Postcondiciones | El Microservicio de Analítica recibe los datos actualizados de reproducción. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Identifica los checkpoints nuevos o actualizados. |
| 2 | Sistema | Envía el lote de datos hacia el Microservicio de Analítica. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | Falla la comunicación con el Microservicio de Analítica | El sistema encola el envío para reintentarlo más tarde. |
 
---

## Módulo 6: Sistema de Notificaciones por Correo
 
  ![Diagrama expandido módulo 6](CDU/CDU_Expandido_M6_202307691.drawio.svg)

---

![CDU24](CDU/CDU_Expandido_CDU24_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0006.1 |
| Nombre | Enviar confirmación de registro |
| Actor | Microservicio de Autenticación |
| Descripción | Envía un correo de confirmación cuando un usuario completa su registro en la plataforma. |
| Precondiciones | Se creó una cuenta nueva. |
| Postcondiciones | El usuario recibe el correo de confirmación de registro. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Recibe el evento de registro exitoso. |
| 2 | Sistema | Genera el contenido del correo de confirmación. |
| 3 | Sistema | Ejecuta enviar correo vía proveedor SMTP. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El evento de registro llega incompleto  | El sistema descarta la notificación y registra el error. |
 
---

![CDU25](CDU/CDU_Expandido_CDU25_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0006.2 |
| Nombre | Enviar alerta de nueva clase publicada |
| Actor | Microservicio de Catálogo |
| Descripción | Notifica a los estudiantes inscritos en un curso cuando se publica una nueva grabación de clase. |
| Precondiciones | Se publicó una grabación nueva en el catálogo. |
| Postcondiciones | Los estudiantes inscritos reciben el correo de alerta. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Recibe el evento de publicación de nueva clase. |
| 2 | Sistema | Genera el contenido del correo de alerta con los datos de la clase. |
| 3 | Sistema | Ejecuta enviar correo vía proveedor SMTP para cada destinatario. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | No hay estudiantes inscritos en el curso | El sistema descarta el envío sin generar correos. |
 
---

![CDU26](CDU/CDU_Expandido_CDU26_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0006.3 |
| Nombre | Enviar aviso general del sistema |
| Actor | Administrador |
| Descripción | Permite al administrador enviar un aviso general a todos los usuarios o a un grupo específico. |
| Precondiciones | El administrador tiene una sesión activa. |
| Postcondiciones | Los destinatarios seleccionados reciben el correo de aviso. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Administrador | Redacta el aviso y selecciona los destinatarios. |
| 2 | Sistema | Genera el contenido del correo de aviso. |
| 3 | Sistema | Ejecuta enviar correo vía proveedor SMTP para cada destinatario. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | No se seleccionó ningún destinatario | El sistema rechaza el envío y muestra "Selecciona al menos un destinatario". |
 
---

![CDU27](CDU/CDU_Expandido_CDU27_202307691.drawio.svg)
 
| Campo | Descripción |
|-------|-------------|
| ID | CDU0006.4 |
| Nombre | Enviar correo vía proveedor SMTP |
| Actor | Proveedor SMTP |
| Descripción | Envía el correo electrónico ya generado hacia el destinatario final utilizando el proveedor SMTP configurado. |
| Precondiciones | Existe un contenido de correo listo para enviar. |
| Postcondiciones | El correo queda enviado. |
 
Flujo principal:
 
| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Envía la solicitud al proveedor SMTP. |
| 2 | Proveedor SMTP | Entrega el correo al destinatario. |
| 3 | Sistema | Registra el envío como exitoso. |
 
Flujos alternativos:
 
| ID | Condición | Acción |
|----|-----------|--------|
| - | - | - |
 
Flujos de excepción:
 
| ID | Condición | Acción |
|----|-----------|--------|
| FE-01 | El proveedor SMTP no responde o rechaza el envío | El sistema encola el correo para reintento posterior. |
 
---

## Vista de Arquitectura (Modelo 4+1)

![Vista](Vistas4+1/Vista4+1_202307691.drawio.svg)
 
### Vista de Escenarios
Describe los casos de uso o situaciones en las que interactúan los usuarios con el sistema. Sirve para validar que la arquitectura cubra los requisitos funcionales.

![DVista1](Vistas4+1/VistaEscenarios_DiagramaCDU_202307691.drawio.svg)

### Vista Lógica
Muestra la estructura funcional del sistema, es decir, las clases, módulos, servicios o entidades y cómo se relacionan entre sí para implementar la lógica del negocio.

![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_202307691.drawio.svg)

![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU1_202307691.drawio.svg)

![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU2_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU3_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU4_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU5_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU6_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU7_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU8_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU9_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU10_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU11_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU12_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU13_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU14_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU15_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU16_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU17_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU18_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU19_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU20_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU21_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU22_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU23_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU24_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU25_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU26_202307691.drawio.svg)
![DVista2](Vistas4+1/VistaLogica_DiagramaSecuencia_CDU27_202307691.drawio.svg)







### Vista de Procesos 
Representa cómo se comunican y coordinan los procesos o servicios del sistema durante la ejecución. Esta vista muestra las llamadas remotas entre servicios, el intercambio de datos y la concurrencia.

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU1_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU2_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU3_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU4_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU5_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU6_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU7_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU8_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU9_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU10_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU11_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU12_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU13_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU14_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU15_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU16_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU17_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU18_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU19_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU20_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU21_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU22_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU23_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU24_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU25_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU26_202307691.drawio.svg)

![DVista3](Vistas4+1/VistaProcesos_DiagramaActividades_CDU27_202307691.drawio.svg)

### Vista de Componentes
Describe la organización del software en componentes o módulos, mostrando cómo se divide el sistema, sus dependencias y la función de cada parte.

![DVista4](Vistas4+1/VistaComponentes_DiagramaDespliegue_202307691.drawio.svg)

### Vista de Despliegue
Explica cómo se distribuye el sistema en la infraestructura física o virtual, indicando servidores, contenedores, dispositivos, redes y dónde se ejecuta cada componente.

![DVista5](Vistas4+1/VistaDespliegue_DiagramaComponentes_202307691.drawio.svg)

## Diseño del Modelado de Datos (DER)

### Auth Service
![D1](ER/DER_MicroservicioAuth_202307691.drawio.svg)

### Objetos programables
| Tipo | Nombre | Descripción |
|---|---|---|
| SP | sp_registrar_usuario | Valida el dominio institucional (llama a fn_validar_dominio_correo) e inserta el usuario junto con su rol por defecto (Estudiante). |
| SP | sp_asignar_rol | Agrega un nuevo perfil/rol a un usuario existente (soporta multiperfil). |
| SP | sp_cambiar_password | Actualiza credenciales dentro de una transacción; dispara el trigger de auditoría. |
| SP | sp_vincular_cuenta_oauth | Vincula un proveedor OAuth institucional a un usuario existente (o lo crea si no existe). |
| SP | sp_solicitar_reset_password | Genera un token_verificacion de tipo RESET_PASSWORD con fecha de expiración. |
| SP | sp_confirmar_verificacion | Valida un token (VERIFICACION_CORREO o RESET_PASSWORD), lo marca como usado y aplica el efecto correspondiente. |
| Vista | vw_usuarios_activos_roles | Usuarios activos con el listado agregado de todos sus roles/perfiles disponibles. |
| Vista | vw_sesiones_activas | Sesiones vigentes (no expiradas) por usuario, usadas por el API Gateway para validación rápida. |
| Función | fn_validar_dominio_correo(correo) | Valida que el correo pertenezca a @ingenieria.usac.edu.gt o @ing.usac.edu.gt. |
| Función | fn_tiene_permiso(rol_id, recurso, accion) | Evalúa la matriz RBAC contra permiso_rbac. |
| Trigger | trg_auditoria_password | AFTER UPDATE OF hash_password ON usuario → inserta un registro en auditoria_credenciales. |
| Trigger | trg_auditoria_rol | AFTER INSERT OR DELETE ON usuario_rol → registra cambios de permisos/roles en auditoria_credenciales. |
| Trigger | trg_marcar_verificado | AFTER UPDATE OF usado ON token_verificacion (tipo VERIFICACION_CORREO) → marca usuario.email_verificado = true. |

### Inscripción Service

![D2](ER/DER_MicroservicioInscripcion_202307691.drawio.svg)

### Objetos programables
 
| Tipo | Nombre | Descripción |
|---|---|---|
| SP | sp_inscribir_estudiante | Valida cupo/duplicidad e inserta la inscripción con estado inicial PENDIENTE. |
| SP | sp_asignar_catedratico_curso | Asigna un catedrático como titular de un curso. |
| SP | sp_asignar_auxiliar_catedratico | Vincula un auxiliar a un catedrático específico (no directamente al curso). |
| Vista | vw_panel_estudiante | Cursos inscritos, estado de matrícula y catedrático asignado, por estudiante. |
| Vista | vw_cursos_por_catedratico | Cursos asignados junto con los auxiliares que apoyan a cada catedrático. |
| Función | fn_estado_matricula(estudiante_id_ref, curso_id) | Calcula el estado vigente de matrícula (ACTIVA, PENDIENTE, RETIRADA). |
| Trigger | trg_auditoria_inscripcion | AFTER UPDATE OF estado_matricula ON inscripcion → registra el cambio de estado en una tabla de auditoría local. |
| Trigger | trg_validar_auxiliar_unico_catedratico | BEFORE INSERT ON asignacion_auxiliar → evita asignaciones duplicadas del mismo auxiliar al mismo catedrático. |

### Catálogo Service
![D3](ER/DER_MicroservicioCatalogo_202307691.drawio.svg)

### Objetos programables
 
| Tipo | Nombre | Descripción |
|---|---|---|
| SP | sp_publicar_clase | Inserta la clase y dispara el trigger de evento de publicación. |
| SP | sp_asociar_etiquetas | Inserta múltiples relaciones clase_etiqueta en una sola transacción. |
| Vista | vw_ficha_tecnica_clase | Combina clase_grabada, curso_catalogo, docente_clase y clase_etiqueta en una sola proyección lista para el frontend. |
| Vista | vw_catalogo_por_semestre | Listado de clases agrupado por semestre/año/escuela. |
| Función | fn_buscar_clases | Búsqueda avanzada con filtros opcionales combinables (semestre, escuela, curso, catedrático, tema). |
| Trigger | trg_evento_clase_publicada | AFTER INSERT ON clase_grabada → inserta un registro en evento_publicacion_pendiente, consumido por el Notificaciones Service vía gRPC. |


### Reproducción Service
![D4](ER/DER_MicroservicioReproduccion_202307691.drawio.svg)

### Objetos programables

| Tipo | Nombre | Descripción |
|---|---|---|
| SP | sp_guardar_checkpoint | Hace *upsert* de historial_reproduccion y checkpoint en una sola transacción (alta concurrencia). |
| SP | sp_registrar_calificacion | Inserta o actualiza la calificación asociada a un historial_id existente. |
| Vista | vw_historial_reciente | Últimas clases vistas por estudiante ordenadas por fecha_ultima_visualizacion, con el porcentaje de avance. |
| Función | fn_calcular_progreso(segundo_actual, duracion_total_segundos) | Calcula el porcentaje de avance del video. |
| Trigger | trg_actualizar_historial | AFTER INSERT OR UPDATE ON checkpoint → actualiza fecha_ultima_visualizacion en historial_reproduccion. |
| Trigger | trg_validar_rango_puntuacion | BEFORE INSERT OR UPDATE ON calificacion → valida que puntuacion esté entre 1 y 5. |

### Analítica Service
![D5](ER/DER_MicroservicioAnalitica_202307691.drawio.svg)

### Objetos programables
 
| Tipo | Nombre | Descripción |
|---|---|---|
| SP | sp_registrar_evento_vista | Hace *upsert* de clase_metrica (si es la primera vez que se ve esa clase) e inserta el evento_vista. Alimentado por Reproducción Service. |
| SP | sp_recalcular_tendencias | Agrega evento_vista por clase para una semana dada y regenera tendencia_semanal (job programado). |
| Vista | vw_ranking_clases | Top de clases por total_vistas y promedio_calificacion. |
| Vista | vw_tendencias_examenes | Temas con mayor crecimiento de vistas en las últimas semanas. |
| Función | fn_calcular_porcentaje_recomendacion(clase_metrica_id) | Combina calificacion_agregada y tendencia_semanal en un puntaje ponderado de recomendación. |
| Trigger | trg_actualizar_calificacion_agregada | AFTER INSERT ON evento_vista (o al sincronizar calificaciones desde Reproducción Service) → recalcula promedio_calificacion y total_calificaciones. |
| Trigger | trg_invalidar_cache_ranking | AFTER INSERT OR UPDATE ON tendencia_semanal → marca bandera de control para invalidar (TTL forzado) la clave correspondiente en Redis. |

### Notificaciones Service
![D6](ER/DER_MicroservicioNotificaciones_202307691.drawio.svg)

### Objetos programables
 
| Tipo | Nombre | Descripción |
|---|---|---|
| SP | sp_registrar_notificacion | Inserta la notificación con estado PENDIENTE (dispara trigger de encolado). |
| SP | sp_marcar_enviada | Actualiza estado a ENVIADA y sincroniza fecha_envio. |
| Vista | vw_notificaciones_pendientes | Notificaciones con estado = 'PENDIENTE' listas para procesar por el worker de correo. |
| Función | fn_renderizar_plantilla(plantilla_id, datos_contexto) | Sustituye variables dinámicas dentro del cuerpo_html de la plantilla. |
| Trigger | trg_encolar_notificacion | AFTER INSERT ON notificacion → inserta automáticamente el registro correspondiente en cola_envio. |
| Trigger | trg_reintento_fallido | AFTER UPDATE OF ultimo_error ON cola_envio → incrementa intentos y calcula fecha_proximo_intento con backoff. |

## Diseño del Modelado de Datos (DER)

### Login Institucional
Este mockup representa la pantalla de autenticación del sistema. Permite a estudiantes y docentes iniciar sesión utilizando exclusivamente su correo institucional de la Facultad de Ingeniería, validando el dominio permitido y garantizando un acceso seguro a la plataforma.

![M1](Mockups/Mockups_Login_202307691.drawio.svg)

### Catálogo
Corresponde a la interfaz principal donde los usuarios pueden explorar el contenido disponible. Incluye herramientas de búsqueda y filtros por semestre, curso, escuela, catedrático y temas específicos, facilitando la localización de las grabaciones académicas.

![M2](Mockups/Mockups_Catalogo_202307691.drawio.svg)

### Reproductor
Muestra la pantalla destinada a la reproducción de las clases grabadas. Además del reproductor multimedia, presenta información de la clase, el progreso de visualización (checkpoint), la opción de calificar el contenido y el porcentaje de recomendación generado por el sistema.

![M3](Mockups/Mockups_Reproductor_202307691.drawio.svg)

### Asignaciones
Este mockup permite al usuario consultar los cursos en los que está inscrito y visualizar la información relacionada con sus asignaciones académicas. También refleja los permisos disponibles según el rol del usuario dentro de la plataforma.

![M4](Mockups/Mockups_Asignaciones_202307691.drawio.svg)

### Configuración
Representa la sección donde el usuario puede administrar la información de su perfil, modificar preferencias personales, gestionar la seguridad de su cuenta y visualizar los datos asociados a su sesión.

![M5](Mockups/Mockups_Configuracion_202307691.drawio.svg)

### Panel Admin
Corresponde a la interfaz exclusiva para administradores del sistema. Desde este panel es posible gestionar usuarios, cursos, grabaciones, permisos y otros elementos administrativos necesarios para el funcionamiento de la plataforma.

![M6](Mockups/Mockups_Admin_202307691.drawio.svg)




## Conclusión
El desarrollo de este proyecto permitió establecer una propuesta integral para una plataforma de streaming académico orientada al entorno universitario, aplicando principios modernos de ingeniería de software y arquitectura de microservicios. A través del análisis, se definió una solución escalable, segura y preparada para atender una alta concurrencia de usuarios.

La propuesta incorpora una arquitectura políglota basada en los lenguajes Go, TypeScript y Python, comunicados mediante gRPC y administrados a través de un API Gateway, permitiendo separar responsabilidades y facilitar el mantenimiento del sistema. Asimismo, la integración de mecanismos de autenticación institucional, almacenamiento en caché con Redis, contenedores Docker y despliegue en la nube fortalece la disponibilidad, el rendimiento y la seguridad de la plataforma.

Finalmente, la documentación desarrollada constituye una base sólida para la implementación del sistema. Esto facilita el trabajo colaborativo del equipo de desarrollo y reduce los riesgos durante las fases de implementación, integración y despliegue del proyecto.
