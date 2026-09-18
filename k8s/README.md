# Despliegue de YoUSAC en GKE

Los manifiestos de `k8s/base` describen los ocho componentes de aplicación y
sus Services internos `ClusterIP`. El overlay `k8s/overlays/production` añade
el Ingress nativo de GKE, el certificado administrado y los HPA de frontend y
Gateway.

## Arquitectura

- `frontend` y `api-gateway` empiezan con dos réplicas y pueden escalar de 2 a
  4 mediante HPA.
- Los seis microservicios internos empiezan con una réplica.
- Los servicios gRPC se descubren por DNS interno:
  `auth-service:50051`, `catalog-service:50052`,
  `reproduccion-service:50053`, `analitica-service:50054`,
  `inscripcion-service:50055` y `notificaciones-service:50056`.
- Los seis servicios que usan PostgreSQL comparten su Pod con un Cloud SQL
  Auth Proxy. La aplicación se conecta a `127.0.0.1:5432`; el proxy usa
  Workload Identity y el connection name de su instancia.
- `yousac-runtime-config` contiene los puertos, nombres DNS, dominio público,
  buckets y demás configuración no sensible. Los connection names se generan
  en `yousac-cloudsql-config` durante el CD porque dependen de las bases e
  instancias existentes; los seis valores pueden repetirse si las bases viven
  en una sola instancia Cloud SQL.
- El Gateway usa una KSA distinta para obtener ADC sobre los buckets de Cloud
  Storage. Los videos y materiales no dependen del disco efímero del Pod.
- El acceso público es exclusivamente el Ingress: `/api` y `/mock-oauth` van
  al Gateway y `/` va al frontend. No se debe crear ningún Service `NodePort`
  o `LoadBalancer`.

La imagen del Cloud SQL Auth Proxy se consume desde el repositorio mantenido
por Google (`gcr.io/cloud-sql-connectors/cloud-sql-proxy`) y está fijada a una
versión; las ocho imágenes de aplicación se publican en el Artifact Registry
del proyecto.

## Recursos GCP que deben existir una sola vez

Desde una máquina con `gcloud` autenticado, y revisando nombres antes de
ejecutar comandos:

```bash
export GCP_PROJECT_ID=yousac-202300396-2026
export GCP_REGION=us-central1
export GKE_CLUSTER_NAME=yousac-prod

gcloud services enable container.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com redis.googleapis.com storage.googleapis.com \
  --project "$GCP_PROJECT_ID"

gcloud container clusters create-auto "$GKE_CLUSTER_NAME" \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT_ID"

gcloud compute addresses create yousac-prod-ip \
  --global --project "$GCP_PROJECT_ID"
```

Si el clúster o la IP ya existen, se deben describir y reutilizar; no se deben
recrear. Después se actualiza el registro A de DuckDNS para que
`yousac-thany.duckdns.org` apunte a la IP global reservada.

## Workload Identity

Crear dos GSA separadas y enlazarlas con las KSA que ya están en
`serviceaccounts.yaml`:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"

gcloud iam service-accounts create yousac-cloudsql-proxy \
  --project "$GCP_PROJECT_ID"
gcloud iam service-accounts create yousac-gateway-storage \
  --project "$GCP_PROJECT_ID"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:yousac-cloudsql-proxy@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/cloudsql.client

for bucket in yousac-videos yousac-material; do
  gcloud storage buckets add-iam-policy-binding "gs://$bucket" \
    --member="serviceAccount:yousac-gateway-storage@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/storage.objectAdmin
done

gcloud iam service-accounts add-iam-policy-binding \
  yousac-cloudsql-proxy@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --project "$GCP_PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member="serviceAccount:$GCP_PROJECT_ID.svc.id.goog[yousac-prod/yousac-runtime]"

gcloud iam service-accounts add-iam-policy-binding \
  yousac-gateway-storage@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --project "$GCP_PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member="serviceAccount:$GCP_PROJECT_ID.svc.id.goog[yousac-prod/yousac-gateway]"
```

El connection name tiene el formato `proyecto:región:instancia`. Los seis
valores reales —uno por servicio, aunque pueden apuntar a la misma instancia—
y el `REDIS_URL` se proporcionan al CD como variables/secretos, no se escriben
en este repositorio.

## Workload Identity Federation para GitHub Actions

El workflow conserva el despliegue por SSH a la VM y añade el despliegue GKE.
Los identificadores no sensibles pueden ser Secrets o Variables existentes;
el workflow recibe el nombre completo del proveedor y de la GSA mediante los
secretos `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_CICD_SERVICE_ACCOUNT`.

El proveedor OIDC debe limitar el `attribute.repository` a
`thanya-gate/SA_PROYECTO_202307691`. La cuenta de CI necesita como mínimo:

- `roles/artifactregistry.writer` sobre el repositorio de imágenes.
- `roles/container.clusterViewer` para obtener las credenciales del clúster.
- Permisos Kubernetes equivalentes a `container.developer` o un RBAC
  específico sobre el namespace `yousac-prod` para aplicar Deployment, Service,
  ConfigMap, HPA e Ingress.

Una creación reproducible del pool, proveedor y vínculo con la cuenta de CI
(revisando primero si ya existen) es:

```bash
export WIF_POOL_ID=github-actions
export WIF_PROVIDER_ID=github
export CI_SERVICE_ACCOUNT=github-actions-cicd
export PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"

gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
  --location=global \
  --display-name="GitHub Actions" \
  --project="$GCP_PROJECT_ID"

gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
  --location=global \
  --workload-identity-pool="$WIF_POOL_ID" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == 'thanya-gate/SA_PROYECTO_202307691'" \
  --project="$GCP_PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding \
  "$CI_SERVICE_ACCOUNT@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --project="$GCP_PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL_ID/attribute.repository/thanya-gate/SA_PROYECTO_202307691"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$CI_SERVICE_ACCOUNT@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/container.clusterViewer
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$CI_SERVICE_ACCOUNT@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/container.developer
```

El valor de `GCP_WORKLOAD_IDENTITY_PROVIDER` será
`projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL_ID/providers/$WIF_PROVIDER_ID`.
Si se usa un RBAC Kubernetes más restrictivo, se conserva únicamente el IAM
necesario para obtener credenciales y se configura ese RBAC conforme a la
política del clúster.

## Secretos y variables del repositorio GitHub

El workflow consume estos nombres en el job de producción:

- `GCP_PROJECT_ID`, `GCP_ARTIFACT_REGISTRY_REGION`,
  `GCP_ARTIFACT_REGISTRY_REPOSITORY`.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_CICD_SERVICE_ACCOUNT`.
- `CLOUD_SQL_CONNECTION_NAME_AUTH`, `CLOUD_SQL_CONNECTION_NAME_CATALOG`,
  `CLOUD_SQL_CONNECTION_NAME_REPRODUCCION`,
  `CLOUD_SQL_CONNECTION_NAME_ANALITICA`,
  `CLOUD_SQL_CONNECTION_NAME_INSCRIPCION` y
  `CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES`.
- `JWT_SECRET`, `DATABASE_URL_AUTH`, `DATABASE_URL_CATALOG`,
  `DATABASE_URL_REPRODUCCION`, `DATABASE_URL_ANALITICA`,
  `DATABASE_URL_INSCRIPCION`, `DATABASE_URL_NOTIFICACIONES` y `REDIS_URL`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_API_KEY` (opcional),
  `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`.

Los valores `DATABASE_URL_*` deben apuntar a `127.0.0.1:5432` dentro del Pod,
por ejemplo `postgresql://usuario:password@127.0.0.1:5432/yousac_auth`.
`REDIS_URL` debe incluir el host/puerto y, si Memorystore exige autenticación,
su credencial en el formato admitido por el cliente Redis. Nunca se debe
cometer un `.env.cloud` ni pegar estos valores en YAML.

## Preflight y despliegue manual

Primero se obtienen credenciales del clúster y se ejecuta el preflight de solo
lectura:

```bash
gcloud container clusters get-credentials yousac-prod \
  --region us-central1 --project yousac-202300396-2026

export CLOUD_SQL_CONNECTION_NAME_AUTH='proyecto:us-central1:auth'
export CLOUD_SQL_CONNECTION_NAME_CATALOG='proyecto:us-central1:catalog'
export CLOUD_SQL_CONNECTION_NAME_REPRODUCCION='proyecto:us-central1:reproduccion'
export CLOUD_SQL_CONNECTION_NAME_ANALITICA='proyecto:us-central1:analitica'
export CLOUD_SQL_CONNECTION_NAME_INSCRIPCION='proyecto:us-central1:inscripcion'
export CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES='proyecto:us-central1:notificaciones'
export MEMORYSTORE_INSTANCE_NAME='nombre-real-de-memorystore'

bash deploy/gke-preflight.sh
```

El preflight no modifica recursos. Si el namespace todavía no existe en un
clúster nuevo, lo informa y permite continuar porque `deploy/k8s-deploy.sh` lo
crea; sí detiene el proceso cuando faltan recursos, permisos, red de
Memorystore o la correspondencia IP/DNS.

Para un despliegue manual se exportan además `K8S_JWT_SECRET`, los seis
`K8S_DATABASE_URL_*`, `K8S_REDIS_URL` y, si aplican, las variables opcionales
`K8S_GOOGLE_CLIENT_ID`, `K8S_GOOGLE_CLIENT_SECRET`, `K8S_YOUTUBE_API_KEY`,
`K8S_SMTP_USER`, `K8S_SMTP_PASS` y `K8S_SMTP_FROM`, junto con `IMAGE_TAG` y
`REGISTRY_BASE`, y se ejecuta:

```bash
bash deploy/k8s-deploy.sh
```

El script renderiza y valida Kustomize, rechaza placeholders y Services
prohibidos, crea/actualiza `yousac-runtime`, aplica el overlay, espera los
ocho rollouts y prueba `/`, `/healthz` y `/api/health`. Si algo falla, muestra
pods, eventos, descripciones y logs recientes. El rollback conservador es:

```bash
kubectl rollout history deployment/api-gateway -n yousac-prod
kubectl rollout undo deployment/api-gateway -n yousac-prod
```

Se repite para el Deployment afectado y luego se confirma con los smoke tests.

El certificado `yousac-managed-cert` puede tardar mientras GKE programa el
balanceador y verifica DNS. El workflow no debe considerarse exitoso hasta que
el recurso esté `Active` y el dominio responda por HTTPS.
