Proyecto Fase 3 - Segundo Semestre 2026
Universidad San Carlos de Guatemala
Facultad de ingeniería.
Ingeniería en ciencias y sistemas

# Proyecto Fase 3:

# YoUSAC

## PONDERACIÓN: 20 pts


## Índice

- Proyecto Fase 3 - Segundo Semestre
- Descripción del problema
- Alcance del sistema
   - 1. Foro de Dudas anclado al minuto exacto
   - 2. Cuaderno de Apuntes Markdown con Marcadores de Tiempo
   - 3. Segmentación por capitulo y temas (Video Chapters)
   - 4. Repositorio de Material Adjunto y Recursos de Laboratorio
   - 5. Playlists de Repaso
- Requisitos y restricciones
   - ● Arquitectura y Backend Políglota:
   - ● Uso Obligatorio de Container Registry:
   - ● Manejo de 2 entornos de Ejecución:
   - ● Pipeline de CI/CD Automatizado:
   - ● Gobierno de código:
   - ● Contenedores e infraestructura:
   - ● Seguridad de la información:
- Entregables Requeridos
   - 1. Documentación Actualizada
   - 2. Código fuente y Manifiestos
   - 3. Entorno Operativo
   - 4. Entregables de Integración y Pruebas:
- Herramientas permitidas
- Cronograma
- Consideraciones
- Hoja de Calificación


Proyecto Fase 3 - Segundo Semestre 2026

## Descripción del problema

Tras el éxito operativo de las Fases 1 y 2, la plataforma universitaria de streaming **YOUSAC**
debe consolidarse como un ecosistema digital distribuido, resiliente y de nivel empresarial.
En esta tercera y última fase, el sistema enfrentará tres grandes desafíos de ingeniería de
software moderna:

1. **Interoperabilidad y Federación:** El sistema debe abrirse a la colaboración
    interinstitucional consumiendo e indexando el catálogo de grabaciones de otra
    instancia independiente de YOUSAC (gestionada por otro grupo de desarrollo),
    además de incorporar de forma nativa los servicios del sistema satélite externo
    **Academix Pass & CertiHub** (construido durante las Prácticas 7 a 10).
2. **Gobernanza Automatizada de Infraestructura (IaC):** Se elimina el
    aprovisionamiento manual en la nube. Toda la topología en Google Cloud Platform
    (GCP) o Amazon Web Services (AWS) debe levantarse de forma programática
    mediante **Terraform** , mientras que la configuración interna de dependencias y
    servidores debe ser orquestada de manera idempotente a través de **Ansible**.
3. **Observabilidad Unificada y Confiabilidad (SRE):** Se exige la implementación de
    un monitoreo en tiempo real mediante métricas con **Prometheus y Grafana** ,
    centralización e indexación de logs transaccionales y de auditoría mediante el **Stack**
    **ELK (Elasticsearch, Logstash y Kibana)** , y la ejecución automatizada de tareas en
    segundo plano mediante **Cronjobs** y validaciones de salud post-despliegue con
    **Smoke Tests**.


Proyecto Fase 3 - Segundo Semestre 2026

## Alcance del sistema

El backend políglota (Go, TypeScript, Python) y el cliente web deben extenderse para
soportar las siguientes capacidades operativas:

### 1. Consumo e Interoperabilidad del Catálogo de Videos de Otro

### Grupo (Federación)

```
● Federación de Acervos Académicos: La plataforma debe conectarse a
través de un servicio de integración con la API expuesta por otro grupo de
laboratorio.
● Búsqueda e Indexación Unificada: El buscador del catálogo de YOUSAC
debe permitir consultar tanto las clases grabadas locales como las
grabaciones publicadas por el grupo federado, identificando visualmente
mediante una etiqueta el origen del contenido (ej. "Grabación Local -
Facultad" vs. "Grabación Externa - Sede / Grupo Aliado" ).
● Reproducción Híbrida: Al seleccionar una clase externa, el reproductor
debe consumir y transmitir el video de forma transparente para el estudiante,
preservando las notas en Markdown y los marcadores de tiempo.
```
### 2. Integración Nativa con la Plataforma Academix Pass & CertiHub

```
● Enlace de Talleres y Clases: Dentro de la vista de cada clase grabada o
curso en YOUSAC, se deben desplegar los talleres de refuerzo y
conferencias en vivo gestionados por el sistema externo Academix Pass.
● Flujo de Reserva Directa: El estudiante autenticado en YOUSAC puede
solicitar su reserva o acreditación con un clic; YOUSAC enviará la orden
hacia la API de Academix Pass (encolándose en su Message Broker
RabbitMQ/Kafka).
● Billetera Universitaria de Certificaciones: Sección en el perfil de usuario
de YOUSAC que consulte las credenciales y diplomas emitidos por CertiHub,
mostrando el estado de verificación y permitiendo la descarga del certificado
con código de autenticidad.
```

Proyecto Fase 3 - Segundo Semestre 2026

### 3. Cronjobs Automatizados de Mantenimiento y Analítica

Implementación de tareas programadas nativas que se ejecuten automáticamente en
segundo plano bajo intervalos temporales estrictos:
● **Cronjob de Purga y Seguridad:** Tarea que se ejecute a intervalos regulares
(ej. cada medianoche) para invalidar tokens JWT revocados, limpiar sesiones
inactivas y archivar intentos fallidos de acceso registrados en las tablas de
auditoría.
● **Cronjob de Agregación de Tendencias Académicas:** Tarea programada
que procese las reproducciones de las últimas 24 horas para recalcular el
ranking de clases más vistas y actualizar de forma predictiva las llaves en
**Redis Cache** antes de los horarios pico de estudio.
● **Cronjob de Notificación de Repaso:** Proceso que identifique estudiantes
asignados a cursos con exámenes próximos y envíe de forma automatizada
alertas por correo institucional sugiriendo las grabaciones mejor calificadas
de dicha unidad.

### 4. Motor Predictivo de Recomendación Académica

```
● Implementación en el microservicio de analítica (Python) de un algoritmo
predictivo de recomendación (inspirado en filtrado colaborativo o similitud por
contenido) que analice el historial de reproducciones del estudiante, los
capítulos más consultados y las valoraciones de la comunidad para sugerir
en el Home: "Clases recomendadas para tu preparación de exámenes".
```
## Requisitos y restricciones

### ● Desacoplamiento y Restricciones Arquitectónicas:

```
○ Todas las bases de datos operacionales (relacionales y NoSQL) deben
ejecutarse en instancias dedicadas o servicios gestionados completamente
fuera del clúster de Kubernetes. Los pods solo mantendrán cadenas de
conexión mediante Secrets cifrados.
```
### ● Matriz Políglota y Tráfico gRPC :

```
○ Se mantiene la interoperabilidad interna síncrona mediante gRPC sobre
HTTP/2 respaldado por archivos Protocol Buffers (.proto) entre Go,
TypeScript y Python.
```
### ● Aislamiento de Infraestructura :

```
El entorno de producción debe residir en una red virtual privada ( VPC ) con subredes
separadas para la capa perimetral (Ingress), capa de aplicación (Pods) y capa de
datos (Bases de datos y almacenamiento de objetos).
```

Proyecto Fase 3 - Segundo Semestre 2026

### ● Infraestructura como Código (IaC con Terraform) :

```
Aprovisionamiento Elástico Total: Queda terminantemente prohibido crear
recursos mediante clics en la consola web de la nube.
Los scripts declarativos de Terraform (.tf) deben aprovisionar:
● Red VPC, subredes públicas/privadas, tablas de enrutamiento y reglas de
cortafuegos (Security Groups).
● Clúster administrado de Kubernetes (GKE o EKS) o clúster productivo.
● Máquinas virtuales de cómputo para el entorno de desarrollo y bases de
datos externas.
● Buckets de almacenamiento de objetos y políticas de acceso.
```
### ● Gestión de Configuración (Ansible Playbooks)

```
Configuración Idempotente: Tras la ejecución de Terraform, los playbooks de
Ansible deben aprovisionar de forma automática y desatendida las instancias de
soporte:
● Instalación y securización del motor Docker y Docker Compose en las VMs
de desarrollo.
● Configuración de dependencias del sistema operativo, paquetes base y
usuarios de despliegue.
● Inicialización y configuración de los agentes de exportación de métricas y
recolectores de logs.
```
### ● Pipeline CI/CD:

```
El pipeline en GitHub Actions o GitLab CI debe detenerse de forma inmediata ante
cualquier fallo en las siguientes etapas:
```
1. **Testing y Calidad:** Ejecución automatizada de pruebas unitarias verificando
    un **umbral mínimo estricto del 75% de cobertura de endpoints**.
2. **Empaquetado y Registry:** Compilación de imágenes y subida con
    etiquetado semántico (ej. v3.0.0) al Container Registry (Docker Hub,
    Artifact Registry).
3. **Despliegue Continuo:** Despliegue automatizado aplicando estrategias de
    **Rollout progresivo** hacia producción.
4. **Smoke Tests Automatizados:** Ejecución de pruebas de humo
    post-despliegue que verifiquen mediante peticiones HTTP que el Ingress
    Controller, el Gateway y las conexiones críticas a BD y Redis están arriba y
    respondiendo con códigos 200 OK. Si los Smoke Tests fallan, el pipeline
    debe emitir una alerta crítica.


Proyecto Fase 3 - Segundo Semestre 2026

### ● Stack ELK:

- **Centralización de Logs:** Despliegue de **Elasticsearch, Logstash y Kibana**.
- Todos los contenedores de los microservicios, el API Gateway y los
    servidores externos deben remitir sus logs hacia Logstash/Elasticsearch.
- **Kibana:** Debe configurarse con al menos un dashboard visual que permita
    filtrar eventos por nivel de severidad (INFO, WARN, ERROR), rastrear
    transacciones de auditoría y visualizar intentos de inicio de sesión no
    autorizados.

### ● Stack de Observabilidad de Métricas (Prometheus & Grafana):

- **Prometheus:** Instrumentación y recolección de métricas de rendimiento en
    tiempo real (uso de CPU/RAM de los nodos y pods, latencia de métodos
    gRPC, peticiones por segundo en el Ingress y tasas de acierto en Redis
    Cache).
- **Grafana:** Despliegue de al menos **dos (2) tableros interactivos** accesibles
    públicamente:
       1. _Dashboard de Infraestructura:_ Salud del clúster, consumo de
          hardware y estado de los pods.
       2. _Dashboard de Negocio y Tareas:_ Monitoreo de reproducciones
          activas, ejecución de los Cronjobs y tráfico de consumo del catálogo
          federado

### ● Seguridad de la información:

```
Se deben de usar de forma obligatoria archivos .env para información sensible
(URLS, contraseñas, IPs, etc), este tipo de información no debe ser subida al
repositorio.
```

Proyecto Fase 3 - Segundo Semestre 2026

## Entregables Requeridos

### 1. Documento Técnico Consolidado de Arquitectura (Markdown / PDF)

Memoria técnica acumulada y actualizada en su totalidad con las 3 fases:

1. Carátula formal e Índice estructurado.
2. Ingeniería de Requerimientos: Listado final consolidado (mínimo 25 RF y RNF
    cuantitativos).
3. Casos de Uso UML Expandidos: Diagramas y narrativas expandidas de los nuevos
    flujos (Consumo federado, Interacción con Academix Pass, Ejecución de Cronjobs y
    Recomendación inteligente) con mini-diagramas locales.
4. Modelo 4+1 Vistas de Kruchten Actualizado: Documentación exhaustiva de las 5
    vistas reflejando la infraestructura elástica, la red VPC, el clúster K8s, la base de
    datos externa y los stacks ELK/Prometheus.
5. Diagrama de Arquitectura de Alto Nivel / Bloques General: Esquema macro
    integrado que ilustre la topología completa (VPC, Ingress, Pods gRPC, BD externa,
    ELK, Prometheus, Grafana, Catálogo federado y conexión con Academix Pass).
6. Diagrama de Flujo del Pipeline CI/CD: Esquema detallado que incluya tests,
    coverage (75%), build, push a registry, deploy, Smoke Tests y telemetría.
7. Matriz de Decisiones Técnicas (Qué, Por qué y Para qué): Justificación técnica
    formal ampliada con: _Terraform, Ansible, ELK Stack, Prometheus, Grafana, Smoke_
    _Tests y Algoritmo de Recomendación_.
8. Matriz SOLID: Justificación analítica detallando Dónde, Cómo y Por qué se aplicaron
    los 5 principios en los módulos de federación e integración.
**9.** Archivos Crudos y Editables: Subida obligatoria de los archivos fuente de
    diagramación (.drawio, .puml, etc.) en la carpeta /docs del repositorio.

### 2. Manual de despliegue

Documento operativo independiente (en Markdown o PDF dentro del repositorio) enfocado
en administradores de sistemas y DevOps:
● Prerrequisitos de herramientas y versiones mínimas (Terraform, Ansible, Docker,
Kubectl, Cloud CLI).
● Configuración de variables de entorno y Secrets requeridos (plantillas de ejemplo
.env.example).
● Guía paso a paso para inicializar la infraestructura con Terraform (terraform
init, plan, apply).
● Guía para la ejecución de los playbooks de Ansible sobre los hosts aprovisionados.
● Verificación y comprobación del estado del clúster de Kubernetes y sus pods
(kubectl get all).
● Procedimiento de resolución de contingencias y Rollback.


Proyecto Fase 3 - Segundo Semestre 2026

### 3. Manual de uso del sistema

Guía interactiva y visual (en Markdown o PDF) orientada a los usuarios finales:
● Guía de acceso con correo institucional @ingenieria.usac.edu.gt y gestión de
sesiones.
● Manual para el **Estudiante:** Navegación por catálogo local y federado, reproductor
con capítulos y apuntes Markdown, uso del foro con timestamps, playlists, reserva
de talleres en Academix Pass y consulta de certificados.
● Manual para el **Auxiliar y Catedrático:** Carga de clases (individual y masiva en
CSV), segmentación de capítulos, subida de materiales de laboratorio y moderación
del foro de dudas.
● Manual para el **Administrador:** Panel de auditoría por triggers, descarga de
reportes CSV/PDF y supervisión de entidades académicas.

### 4. Presentación de defensa

Como cierre formal del proyecto de graduación del laboratorio, cada trío realizará una
defensa ejecutiva y técnica de su plataforma ante el evaluador:
● **Límite Máximo de Tiempo:** La presentación tendrá una duración máxima estricta de
**20 minutos**.
● **Participación Colectiva: Todos los integrantes del grupo deben exponer
activamente** , demostrando fluidez técnica, vocabulario ingenieril apropiado y
dominio absoluto de la arquitectura.
● **Estructura Obligatoria de la Exposición:**

1. **El Problema Inicial:** Diagnóstico de los retos del streaming académico
    universitario, cuellos de botella de sistemas monolíticos y justificación de la
    necesidad de una solución escalable y desacoplada.
2. **Planteamiento de la Solución y Toma de Decisiones:** Fundamentación
    analítica de la arquitectura seleccionada. Explicación de las matrices técnicas
    (por qué microservicios políglotas, por qué gRPC, por qué Terraform +
    Ansible, y por qué el desacoplamiento con ELK y Prometheus/Grafana).
3. **Demostración de la Solución Final en Vivo:** Recorrido en tiempo real por el
    sistema en producción demostrando:
       ■ El consumo del catálogo de clases del otro grupo.
       ■ La integración con la plataforma Academix Pass & CertiHub.
       ■ La ejecución en vivo de los Smoke Tests en el pipeline de CI/CD.
       ■ Visualización de logs en Kibana (ELK) y tableros interactivos de
          Grafana bajo tráfico.


Proyecto Fase 3 - Segundo Semestre 2026

### 4. Entregables de Integración y Pruebas:

```
● Historial de Git e Integración (Pull Requests): Evidencia en el repositorio del
uso correcto de ramas y los Pull Request aprobados para la consolidación
del proyecto.
● Creación del Tag con la Versión V3.0.0.
```
## Herramientas permitidas

```
Tipo Categoría Descripción
Obligatorio Lenguajes Go, TypeScript, Python
Opcional Framework FastAPI, Flask, Python,
Express, NestJS, Gin
Obligatorio Comunicación gRPC
Obligatorio Contratos Protocol Buffers
Opcional Seguridad y Sesiones JWT, Session Cookies,
OAuth
Obligatorio Almacenamiento Caché Redis
Opcional Base de datos MSSQL, MySQL,
PostgreSQL, MongoDB
Obligatorio Contenedores Docker
Obligatorio Orquestación Docker-Compose
Obligatorio Control de Versiones Github
Opcional Documentación, Diseño,
Modelado
Excalidraw, Figma, Canva,
LucidChart, Draw.io,
StarUML, Visual Paradigm,
FossFlow
Obligatorio Orquestador de Producción Kubernetes (K8s) / Google
Kubernetes Engine (GKE)
Obligatorio Automatización CI/CD GitHub Actions o Gitlab CI
Obligatorio Almacenamiento de
Imágenes
Container Registry (Docker
Hub, Artifact Registry,
GitHub Packages)
Obligatorio Entorno de Desarrollo Docker Compose
```
**Obligatorio** Testing Frameworks (^) go test (Go), Jest /


Proyecto Fase 3 - Segundo Semestre 2026
Mocha (TypeScript),
pytest / unittest
(Python)


Proyecto Fase 3 - Segundo Semestre 2026

## Cronograma

```
Tipo Fecha Inicio Fecha Fin
Asignación de Proyecto 17/09/2026 23/10/
Elaboración 17/09/2026 23/10/
Calificación 24/10/2026 24/10/
```
## Consideraciones

```
● Fecha límite de entrega: 20 de Septiembre a las 23:
● Nombre del repositorio: SA_PROYECTO_GX
● Colaborador: Samashoas
● Medio de entrega: UEDI
● Documento Técnico: Formato MarkDown que incluya tabla de integrantes, índice,
introducción, desarrollo de todos los diagramas y conclusiones.
● No se permite el uso de herramientas como supabase o prisma para la gestión de la
base de datos
● No se calificará ninguna funcionalidad en el entorno local, solo se calificarán
funcionalidades en el entorno de la nube.
● Se deben cargar los archivos crudos de la documentación al repositorio, de lo
contrario el diagrama no será válido.
● Se calificará en base a la documentación, si algún elemento no se encuentra
documentado no será tomado en cuenta para la calificación.
```

Proyecto Fase 3 - Segundo Semestre 2026

## Hoja de Calificación

```
Descripción de Ponderación Valor Descripción Punteo
Documentación e Ingeniería de
Software
25pts Evaluación de Artefactos
Documento de Arquitectura y Vistas
(4+1)
8 Documento unificado con RF,
Casos de Uso expandidos,
Vistas 4+1 completas,
Diagrama de Bloques macro
y archivos crudos editables.
Justificación de Decisiones (SOLID y
Qué/Por qué/Para qué)
7 Justificación formal de
Terraform, Ansible, ELK,
Prometheus, Grafana,
Cronjobs y matriz de
aplicación SOLID en la
federación.
Manuales Técnicos (Despliegue y Uso) 10 Manual de Despliegue paso a
paso
(Terraform/Ansible/K8s) y
Manual de Usuario completo
para todos los roles con
capturas legibles.
Funcionalidades e integracion 35pts Evaluación de Lógica de
Negocio en Producción
Consumo de Catálogo Externo (Otro
Grupo)
10 Búsqueda, listado y
reproducción fluida de clases
provistas por la API del otro
grupo de desarrollo en vivo.
Integración con Academix Pass &
CertiHub
8 Reserva interactiva de
talleres desde la clase y
visualización verificada de
certificados en el perfil del
estudiante.
Cronjobs y Motor Predictivo de
Recomendación
7 Cronjobs automáticos de
purga y agregación
funcionando en backend, y
cartelera personalizada de
recomendación en el Home.
Infraestructura como código y
observabilidad
35pts Evaluación de IaC,
Automatización y
Monitoreo Cloud:
IaC con Terraform y Ansible 12 Aprovisionamiento elástico
de red y cómputo vía scripts
.tf y configuración de
servidores desatendida
mediante playbooks de
Ansible.
Centralización de Logs (Stack ELK) 8 Recolección de logs en
Elasticsearch/Logstash y
visualización de tableros
interactivos de auditoría en
Kibana.
Métricas en Prometheus y Grafana 8 Prometheus extrayendo
métricas y Grafana
desplegando en vivo los dos
```

Proyecto Fase 3 - Segundo Semestre 2026
tableros (Infraestructura y
Negocio/Cronjobs).
Pipeline CI/CD con Smoke Tests y
Registry
7 Pipeline automático (Test
75%, Push Registry, Deploy
K8s) con cortocircuito ante
errores y ejecución exitosa
de Smoke Tests.
**Sustentación y Defensa 10 pts Evaluación Técnica
Individual**
Presentación y Dominio Técnico 15 Ajuste estricto a los 20
minutos, abordaje de los 3
pilares (Problema, Toma de
decisiones, Solución final),
participación activa de todo
el grupo y excelente fluidez.
**Total 100 pts Punteo ponderado
equivalente a 20 puntos
netos.**


