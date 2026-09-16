# Pipeline CI/CD — GitHub Actions + Artifact Registry + VM + GKE

> Práctica 6 — Software Avanzado, 2do Semestre 2026

`.github/workflows/ci-cd.yml` conserva dos destinos. Después de que las pruebas
pasan, publica las ocho imágenes en Artifact Registry con aliases y con el tag
inmutable `commit-<GITHUB_SHA>`. El job `deploy-k8s` despliega ese tag en el
cluster GKE Autopilot de producción mediante Workload Identity Federation,
Kustomize, rollouts y smoke tests HTTPS. El job `deploy` sigue actualizando la
VM de desarrollo por SSH con `docker compose pull` y
`docker compose up -d --no-build`; la VM nunca compila el repositorio. El
workflow independiente `.github/workflows/cloud-integration.yml` permite
ejecutar posteriormente la batería de integración contra la URL pública.

## 1. Descripción general

El repositorio cuenta con tres workflows en `.github/workflows/`:

| Workflow | Archivo | Disparadores | Función |
|---|---|---|---|
| Pruebas unitarias | `unit-tests.yml` | push/PR a `main`, `develop` | Ejecuta las suites de pruebas de los 8 servicios. |
| CI/CD completo | `ci-cd.yml` | push a `main`, tags `v*`/`V*`, PR a `main`, manual | Pruebas → build → publicación → GKE en `main` y VM de desarrollo. |
| Integración Cloud | `cloud-integration.yml` | ejecución manual | Valida la VM pública y compara opcionalmente contra un entorno de referencia. |

### Flujo del pipeline CI/CD

```mermaid
flowchart LR
    A[Push a main / Tag v* o V* / PR] --> B{Job: tests}
    B -->|Jest x6| C[Node 20]
    B -->|go test| D[Go 1.24]
    B -->|pytest| E[Python 3.12]
    C --> F{¿Todas las pruebas pasan?}
    D --> F
    E --> F
    F -->|No| G[Pipeline cortocircuitado:\nninguna imagen se publica]
    F -->|Sí| H[Job: resolve-image-tag]
    H --> I[Job: publish\nWIF + Artifact Registry]
    I --> J[Build y push de 8 imágenes\naliases + commit-SHA]
    J --> M[Job: deploy\nSSH a la VM (main/tags)]
    M --> N[Compose pull + health checks]
    J --> K{Push a main}
    K -->|Sí| O[Job: deploy-k8s\nWIF + credenciales GKE]
    O --> P[Apply Kustomize\nrollouts + smoke HTTPS]
```

**Requisito de cortocircuito:** el job `publish` depende de `tests` y
`resolve-image-tag`, por lo que si **una sola prueba falla**, la construcción y
publicación de imágenes no se ejecuta. Además, la estrategia `fail-fast: true`
detiene la matriz al primer fallo.

## 2. Imágenes publicadas

Las 8 imágenes se publican en:

```
<REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<GCP_ARTIFACT_REGISTRY_REPOSITORY>/<servicio>
```

| Servicio | Contexto de build | Dockerfile |
|---|---|---|
| `frontend` | `Frontend/` | `Frontend/Dockerfile` |
| `api-gateway` | `Backend/` | `Backend/api-gateway/Dockerfile` |
| `auth-service` | `Backend/` | `Backend/services/auth-service/Dockerfile` |
| `catalog-service` | `Backend/` | `Backend/services/catalog-service/Dockerfile` |
| `inscripcion-service` | `Backend/` | `Backend/services/inscripcion-service/Dockerfile` |
| `notificaciones-service` | `Backend/` | `Backend/services/notificaciones-service/Dockerfile` |
| `reproduccion-service` | `Backend/services/reproduccion-service/` | `Dockerfile` |
| `analitica-service` | `Backend/services/analitica-service/` | `Dockerfile` |

> **Nota:** los servicios TypeScript se compilan con el contexto `Backend/` porque sus Dockerfiles copian los contratos compartidos de `Backend/proto/`.

## 3. Estrategia de etiquetado (versionamiento semántico)

Implementado con `docker/metadata-action@v5`:

| Evento | Etiquetas generadas por servicio |
|---|---|
| Tag de Git `v1.3.0` o `V1.3.0` | `<servicio>:1.3.0` y `<servicio>:latest` |
| Push a `main` | `<servicio>:main`, `<servicio>:sha-<hash-corto>` y `<servicio>:commit-<GITHUB_SHA>` |
| Ejecución manual desde `main` | `<servicio>:main`, `<servicio>:sha-<hash-corto>` y `<servicio>:commit-<GITHUB_SHA>` |

El workflow acepta ambas convenciones de tag Git (`v` y `V`) y normaliza la etiqueta
de la imagen a la versión semántica sin prefijo. Esto cumple el requisito de la
práctica `<nombre_del_servicio>:<Tag_de_la_rama_release>`:

```bash
git tag V1.3.0
git push origin V1.3.0
```

## 4. Repository Secrets requeridos

La práctica exige el uso de **Repository Secrets** para las credenciales del Registry
(`Settings → Secrets and variables → Actions → New repository secret`):

| Secret | Descripción | Ejemplo |
|---|---|---|
| `GCP_PROJECT_ID` | ID del proyecto de Google Cloud | `yousac-123456` |
| `GCP_ARTIFACT_REGISTRY_REGION` | Región del repositorio de Artifact Registry | `us-central1` |
| `GCP_ARTIFACT_REGISTRY_REPOSITORY` | Nombre del repositorio de Artifact Registry | `yousac` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Recurso completo del proveedor OIDC de GitHub | `projects/.../providers/github` |
| `GCP_CICD_SERVICE_ACCOUNT` | GSA usada por GitHub Actions mediante WIF | `github-actions-cicd@...iam.gserviceaccount.com` |

> **Validación estricta:** en ejecuciones de publicación y despliegue, la ausencia
> de cualquiera de estos secrets hace fallar el pipeline. Esto evita reportar una
> ejecución verde cuando no se publicaron imágenes.

La autenticación contra Google Cloud usa Workload Identity Federation: GitHub
Actions presenta su token OIDC y recibe credenciales temporales para publicar
en Artifact Registry y administrar el despliegue GKE. No se generan ni se
almacenan llaves JSON de Service Account.

## 5. Configuración en GCP y credenciales

### 5.0 Guía con la Consola Web (console.cloud.google.com)

**1. Obtener el Project ID (`GCP_PROJECT_ID`)**
- Barra superior → selector de proyectos → seleccionar el proyecto.
- Copiar el **Project ID** exacto (no el nombre ni el número del proyecto).

**2. Habilitar la API de Artifact Registry**
- Menú ☰ → *APIs & Services → Library* → buscar "Artifact Registry API" → **Enable**.

**3. Crear el repositorio de imágenes** (genera los valores de región y nombre)
- Menú ☰ → *Artifact Registry → Repositories → + CREATE*.
- Name: `yousac` · Format: **Docker** · Location type: **Region** · Región: `us-central1`.
- La región y el nombre elegidos son los valores de `GCP_ARTIFACT_REGISTRY_REGION`
  y `GCP_ARTIFACT_REGISTRY_REPOSITORY`.

**4. Configurar Workload Identity Federation**
- En *IAM & Admin → Workload Identity Federation*, crear un pool OIDC para
  GitHub Actions y un proveedor con issuer
  `https://token.actions.githubusercontent.com`.
- Restringir el atributo `attribute.repository` al repositorio
  `thanya-gate/SA_PROYECTO_202307691`.
- Crear una GSA para CI con permiso de escritura en Artifact Registry y los
  permisos Kubernetes descritos en [la guía de GKE](../k8s/README.md).
- Copiar los nombres completos del proveedor y de la GSA a
  `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_CICD_SERVICE_ACCOUNT`.

> La federación evita guardar llaves JSON de larga duración en GitHub.

**5. Cargar los secrets en GitHub**
- Repo → *Settings → Secrets and variables → Actions → New repository secret*.
- Crear los cinco identificadores de GCP/WIF de la tabla de la sección 4 y los
  secretos runtime listados en [k8s/README.md](../k8s/README.md).

**6. Verificar el pipeline**
- Pestaña *Actions* → workflow "CI/CD — Pruebas, publicación y despliegue" → **Run workflow**.
- Al finalizar, en *Artifact Registry → `yousac`* deben listarse las 8 imágenes con sus etiquetas.

### 5.1 Crear el repositorio de Artifact Registry (gcloud)

```bash
gcloud artifacts repositories create yousac \
  --repository-format=docker \
  --location=us-central1 \
  --project=<GCP_PROJECT_ID>
```

### 5.2 Crear la Service Account para el pipeline

```bash
# Crear la cuenta de servicio para WIF
gcloud iam service-accounts create github-actions-cicd \
  --display-name="GitHub Actions - Artifact Registry" \
  --project=<GCP_PROJECT_ID>

# Otorgar permiso de escritura en Artifact Registry
gcloud projects add-iam-policy-binding <GCP_PROJECT_ID> \
  --member="serviceAccount:github-actions-cicd@<GCP_PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# La autenticación de GitHub se configura mediante WIF; no se genera ninguna
# llave JSON para el pipeline.
```

### 5.3 Cargar los identificadores de GCP

```bash
gh secret set GCP_PROJECT_ID --body "<GCP_PROJECT_ID>"
gh secret set GCP_ARTIFACT_REGISTRY_REGION --body "us-central1"
gh secret set GCP_ARTIFACT_REGISTRY_REPOSITORY --body "yousac"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github"
gh secret set GCP_CICD_SERVICE_ACCOUNT --body "github-actions-cicd@<GCP_PROJECT_ID>.iam.gserviceaccount.com"
```

> **Seguridad:** la publicación de imágenes es **100 % automática** desde el
> pipeline y usa credenciales temporales federadas.

### 5.4 Identidad de la VM para leer Artifact Registry

La VM debe tener una Service Account adjunta con permiso mínimo de lectura en el
repositorio. Esta identidad es independiente de la GSA federada de GitHub
Actions. No se crea ni se copia una llave JSON en la VM.

En la Consola Web:

1. En *IAM & Admin → Service Accounts*, crear o seleccionar una cuenta para la VM.
2. En *Artifact Registry → Repositories → yousac → Permissions*, otorgarle
   **Artifact Registry Reader**.
3. En *Compute Engine → VM instances → yousac-vm-nube → Edit*, seleccionar esa
   cuenta como **Service account** y conservar un alcance que permita acceder a
   las APIs de Google Cloud, normalmente `cloud-platform`.

Equivalente con `gcloud`:

```bash
PROJECT_ID=<GCP_PROJECT_ID>
REGION=us-central1
REPOSITORY=yousac
VM_NAME=yousac-vm-nube
ZONE=us-central1-a
VM_SA="yousac-vm-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create yousac-vm-runtime \
  --display-name="YoUSAC VM - Artifact Registry Reader" \
  --project="$PROJECT_ID"

gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$VM_SA" \
  --role="roles/artifactregistry.reader"

gcloud compute instances set-service-account "$VM_NAME" \
  --zone="$ZONE" \
  --service-account="$VM_SA" \
  --scopes=cloud-platform
```

Si la VM ya tiene una cuenta de servicio, primero debe inspeccionarse y
conservarse si ya cuenta con el permiso requerido; `set-service-account` puede
reemplazar la identidad configurada.

### 5.5 Secretos SSH y variable de la URL pública

Generar una llave Ed25519 fuera del repositorio y agregar la clave pública en
*Compute Engine → VM instances → Edit → SSH Keys* con el formato
`usuario:clave_publica`. También puede agregarse con metadata:

```bash
gcloud compute instances add-metadata "$VM_NAME" \
  --zone="$ZONE" \
  --metadata-from-file=ssh-keys=<archivo-con-usuario-y-clave-publica>
```

Crear en GitHub, en *Settings → Secrets and variables → Actions*:

| Nombre | Contenido |
|---|---|
| `VM_HOST` | IP pública o hostname SSH de la VM |
| `VM_USER` | Usuario Linux que tiene `sudo` sin contraseña |
| `VM_SSH_KEY` | Contenido de la clave privada Ed25519 |
| `VM_KNOWN_HOSTS` | Host key verificada de la VM |

Crear además la variable de repositorio `CLOUD_BASE_URL`, por ejemplo
`http://136.119.139.125` o el dominio público configurado. La host key debe
verificarse previamente por un canal confiable; el workflow usa
`StrictHostKeyChecking=yes` y nunca desactiva la validación SSH.

## 6. Verificación local

Validar la sintaxis de los workflows (requiere [`actionlint`](https://github.com/rhysd/actionlint)):

```bash
actionlint .github/workflows/ci-cd.yml
```

Probar el build de una imagen con el mismo contexto que usa el pipeline:

```bash
docker build -f api-gateway/Dockerfile -t api-gateway:ci ./Backend
```

## 7. Evidencias para el Informe Técnico

1. Ejecución del workflow `ci-cd.yml` en verde, incluyendo `deploy-k8s` para
   `main` y `deploy` para la VM (pestaña *Actions* de GitHub).
2. Resumen generado por el pipeline (`GITHUB_STEP_SUMMARY`) con las etiquetas y el endpoint validado.
3. Enlace al perfil del repositorio en Artifact Registry con las imágenes versionadas.
4. Evidencia de la VM actualizada con `docker compose pull` y `up --no-build`.
5. Captura de un pull request donde las pruebas bloquean la publicación.

### 7.1 Validación registrada del despliegue `V1.2.1`

La primera prueba completa del CD hacia la VM se ejecutó mediante el tag
`V1.2.1`, que el workflow normalizó a la etiqueta de imagen `1.2.1`.

| Dato | Resultado |
|---|---|
| Ejecución | [GitHub Actions — run 34423627304](https://github.com/thanya-gate/SA_PROYECTO_202307691/actions/runs/34423627304) |
| Evento | Push del tag `V1.2.1` |
| Commit | `65463635c644dadd50f7b272e5052bd103f66099` |
| Pruebas unitarias | 8 jobs aprobados |
| Publicación | 8 imágenes publicadas en Artifact Registry |
| Despliegue | Job `Deploy — VM de desarrollo` aprobado |
| VM | `yousac-vm-nube`, zona `us-central1-a` |
| URL pública | `http://136.119.139.125` |
| Imagen desplegada | Servicios de aplicación con etiqueta `1.2.1` |

La ejecución confirmó la secuencia `docker compose pull` y
`docker compose up -d --no-build --remove-orphans`. Los health checks del
Gateway (`127.0.0.1:8080/health`), frontend (`127.0.0.1:8081/healthz`) y
endpoint público (`/api/health`) respondieron correctamente. La VM no recibió
`.env.cloud` y no ejecutó `docker build`.

![Resumen del pipeline CI/CD `V1.2.1`](img/ci-cd-v1.2.1-resumen.png)

![Detalle del job `Deploy — VM de desarrollo`](img/ci-cd-v1.2.1-deploy.png)

## 8. Actualización automática de la VM sin compilar en el servidor

`docker-compose.cloud.yml` referencia las ocho imágenes del Registry con
`REGISTRY_BASE` e `IMAGE_TAG`. El job `deploy` copia únicamente el Compose y los
archivos públicos de Caddy; `.env.cloud` debe existir previamente en
`/opt/yousac` y nunca se almacena en GitHub.

Para cada push a `main` o tag `vX.Y.Z`/`VX.Y.Z`, después de publicar las imágenes,
el workflow ejecuta remotamente:

```bash
sudo gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
sudo docker compose --env-file /opt/yousac/.env.cloud \
  -f /opt/yousac/docker-compose.cloud.yml config --quiet
sudo docker compose --env-file /opt/yousac/.env.cloud \
  -f /opt/yousac/docker-compose.cloud.yml pull
sudo docker compose --env-file /opt/yousac/.env.cloud \
  -f /opt/yousac/docker-compose.cloud.yml up -d --no-build --remove-orphans
```

El workflow verifica después los endpoints locales `127.0.0.1:8080/health` y
`127.0.0.1:8081/healthz`, y finalmente `${CLOUD_BASE_URL}/api/health`. Si fallan
las pruebas, la publicación, SSH o los health checks, el job `deploy` no se
considera exitoso. La VM no ejecuta `docker build`.

### 8.1 Validación técnica del despliegue en GCP

La validación técnica del despliegue `V1.2.1` se realizó sobre:

- VM `yousac-vm-nube`, tipo `e2-medium`, zona `us-central1-a`.
- Cloud SQL PostgreSQL 16 `yousac-p6-db`, con seis bases independientes.
- Redis `7-alpine` en la VM para el servicio de AnalÃ­tica.
- Imágenes de los ocho servicios con la etiqueta `1.2.1`.
- Borde pÃºblico: `http://136.119.139.125`.

Los ocho servicios de aplicación quedaron activos y saludables en la VM:
`frontend`, `api-gateway`, `auth-service`, `catalog-service`,
`inscripcion-service`, `notificaciones-service`, `reproduccion-service` y
`analitica-service`.

El reporte `artifacts/cloud-parity.json` registra una validación de paridad
anterior, realizada con la imagen histórica `vm-nube-ca31976`. Ese reporte se
conserva como antecedente funcional y no sustituye la evidencia del despliegue
CD `V1.2.1` registrada en la sección 7.1.

El `--no-build` y la ausencia de bloques `build:` en el compose garantizan la
restricción de la práctica: la actualización llega desde Artifact Registry y
no se recompila en la VM. Después de que el gateway esté saludable, ejecutar
`tests/integration/cloud-parity.mjs` contra el dominio o IP pública.

## 9. Despliegue automático en GKE Autopilot

La producción usa el overlay [Kustomize](../k8s/overlays/production) sobre el
cluster `yousac-prod` del proyecto `yousac-202300396-2026`, región
`us-central1`, y namespace `yousac-prod`. En cada push a `main`, el job
`deploy-k8s`:

1. Se autentica mediante Workload Identity Federation, sin `GCP_SA_KEY`.
2. Publica ocho imágenes y usa `commit-${GITHUB_SHA}` como referencia que
   Kubernetes despliega.
3. Crea/actualiza el Secret `yousac-runtime` a partir de GitHub Secrets.
4. Renderiza y valida `kubectl kustomize`, rechazando `NodePort`,
   `LoadBalancer`, placeholders o imágenes fuera del Registry configurado.
5. Ejecuta `kubectl apply -k`, espera los ocho rollouts y espera que
   `yousac-managed-cert` llegue a `Active`.
6. Comprueba `https://yousac-thany.duckdns.org/`, `/healthz` y `/api/health`.

El Ingress nativo de GKE reserva la IP global `yousac-prod-ip`, dirige `/api`
y `/mock-oauth` al Gateway y el resto al frontend. Todos los Services son
`ClusterIP`; PostgreSQL, Redis y Cloud Storage permanecen fuera de los pods.
Los detalles de creación de infraestructura, permisos, secretos y preflight
están en [k8s/README.md](../k8s/README.md), y el script operativo es
[`deploy/k8s-deploy.sh`](../deploy/k8s-deploy.sh).

La implementación de manifiestos y workflow queda versionada, pero la
evidencia de aceptación en GCP (clúster creado, certificado activo, DNS,
rollouts y URL HTTPS) debe capturarse después de configurar los recursos
externos. Hasta entonces no se declara el despliegue productivo como validado.
