#!/usr/bin/env bash

# Despliega una versión inmutable de YoUSAC en GKE. El script no crea GCP
# resources: el clúster, las bases, Redis, buckets, IP y Workload Identity se
# preparan con deploy/gke-preflight.sh y la guía de k8s/README.md.

set -Eeuo pipefail

readonly NAMESPACE="${K8S_NAMESPACE:-yousac-prod}"
readonly DOMAIN="${K8S_DOMAIN:-yousac-thany.duckdns.org}"
readonly DEPLOYMENT_DIR="${K8S_DEPLOYMENT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
readonly K8S_SOURCE_DIR="$DEPLOYMENT_DIR/k8s"
readonly REQUIRED_NAMESPACE="yousac-prod"

: "${IMAGE_TAG:?IMAGE_TAG es obligatorio (ej. commit-<GITHUB_SHA>)}"
: "${REGISTRY_BASE:?REGISTRY_BASE es obligatorio (host/proyecto/repositorio)}"
: "${CLOUD_SQL_CONNECTION_NAME_AUTH:?Falta CLOUD_SQL_CONNECTION_NAME_AUTH}"
: "${CLOUD_SQL_CONNECTION_NAME_CATALOG:?Falta CLOUD_SQL_CONNECTION_NAME_CATALOG}"
: "${CLOUD_SQL_CONNECTION_NAME_REPRODUCCION:?Falta CLOUD_SQL_CONNECTION_NAME_REPRODUCCION}"
: "${CLOUD_SQL_CONNECTION_NAME_ANALITICA:?Falta CLOUD_SQL_CONNECTION_NAME_ANALITICA}"
: "${CLOUD_SQL_CONNECTION_NAME_INSCRIPCION:?Falta CLOUD_SQL_CONNECTION_NAME_INSCRIPCION}"
: "${CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES:?Falta CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES}"
: "${K8S_JWT_SECRET:?Falta K8S_JWT_SECRET}"
: "${K8S_DATABASE_URL_AUTH:?Falta K8S_DATABASE_URL_AUTH}"
: "${K8S_DATABASE_URL_CATALOG:?Falta K8S_DATABASE_URL_CATALOG}"
: "${K8S_DATABASE_URL_REPRODUCCION:?Falta K8S_DATABASE_URL_REPRODUCCION}"
: "${K8S_DATABASE_URL_ANALITICA:?Falta K8S_DATABASE_URL_ANALITICA}"
: "${K8S_DATABASE_URL_INSCRIPCION:?Falta K8S_DATABASE_URL_INSCRIPCION}"
: "${K8S_DATABASE_URL_NOTIFICACIONES:?Falta K8S_DATABASE_URL_NOTIFICACIONES}"
: "${K8S_REDIS_URL:?Falta K8S_REDIS_URL}"

# OAuth mock no necesita credenciales de Google, pero se conservan como keys
# estables para permitir cambiar a google sin cambiar los manifiestos.
: "${K8S_GOOGLE_CLIENT_ID:=}"
: "${K8S_GOOGLE_CLIENT_SECRET:=}"
: "${K8S_YOUTUBE_API_KEY:=}"
: "${K8S_SMTP_USER:=}"
: "${K8S_SMTP_PASS:=}"
: "${K8S_SMTP_FROM:=no-responder@yousac.edu.gt}"

if [[ "$NAMESPACE" != "$REQUIRED_NAMESPACE" ]]; then
  echo "ERROR: el plan fija el namespace '$REQUIRED_NAMESPACE'; recibido '$NAMESPACE'." >&2
  exit 1
fi

if [[ ! -d "$K8S_SOURCE_DIR" ]]; then
  echo "ERROR: no existe el directorio de manifiestos: $K8S_SOURCE_DIR" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "ERROR: kubectl es obligatorio para desplegar en GKE." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl es obligatorio para los smoke tests." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq es obligatorio para comprobar la salud de los backends del Ingress." >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/yousac-k8s.XXXXXX")"
rendered_file="$work_dir/rendered.yaml"
trap 'status=$?; if (( status != 0 )); then diagnose; fi; rm -rf -- "$work_dir"; exit "$status"' EXIT

diagnose() {
  set +e
  echo "===== Diagnóstico Kubernetes: pods =====" >&2
  kubectl get pods -n "$NAMESPACE" -o wide >&2
  echo "===== Diagnóstico Kubernetes: deployments =====" >&2
  kubectl get deployments -n "$NAMESPACE" >&2
  echo "===== Diagnóstico Kubernetes: eventos =====" >&2
  kubectl get events -n "$NAMESPACE" --sort-by=.lastTimestamp >&2
  echo "===== Diagnóstico Kubernetes: describe pods =====" >&2
  kubectl describe pods -n "$NAMESPACE" -l app.kubernetes.io/part-of=yousac >&2
  echo "===== Diagnóstico Kubernetes: logs recientes =====" >&2
  kubectl logs -n "$NAMESPACE" -l app.kubernetes.io/part-of=yousac \
    --all-containers --prefix --tail=100 >&2
}

replace_literal() {
  local file="$1"
  local search="$2"
  local replacement="$3"
  local escaped
  escaped="$(printf '%s' "$replacement" | sed 's/[&|\\]/\\&/g')"
  sed -i.bak "s|${search}|${escaped}|g" "$file"
  rm -f -- "${file}.bak"
}

cp -R "$K8S_SOURCE_DIR" "$work_dir/k8s"
production_dir="$work_dir/k8s/overlays/production"

# La imagen base del overlay queda siempre en Artifact Registry y solo cambia
# la referencia del repositorio/tag para cada corrida del CD.
replace_literal "$production_dir/kustomization.yaml" \
  'us-central1-docker.pkg.dev/yousac-202300396-2026/yousac' \
  "$REGISTRY_BASE"
replace_literal "$production_dir/kustomization.yaml" 'newTag: main' "newTag: $IMAGE_TAG"

echo "Creando/actualizando el namespace $NAMESPACE..."
kubectl apply -f "$work_dir/k8s/base/namespace.yaml"

echo "Creando/actualizando ConfigMap de connection names Cloud SQL..."
kubectl create configmap yousac-cloudsql-config \
  --namespace "$NAMESPACE" \
  --from-literal=CLOUD_SQL_CONNECTION_NAME_AUTH="$CLOUD_SQL_CONNECTION_NAME_AUTH" \
  --from-literal=CLOUD_SQL_CONNECTION_NAME_CATALOG="$CLOUD_SQL_CONNECTION_NAME_CATALOG" \
  --from-literal=CLOUD_SQL_CONNECTION_NAME_REPRODUCCION="$CLOUD_SQL_CONNECTION_NAME_REPRODUCCION" \
  --from-literal=CLOUD_SQL_CONNECTION_NAME_ANALITICA="$CLOUD_SQL_CONNECTION_NAME_ANALITICA" \
  --from-literal=CLOUD_SQL_CONNECTION_NAME_INSCRIPCION="$CLOUD_SQL_CONNECTION_NAME_INSCRIPCION" \
  --from-literal=CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES="$CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Creando/actualizando el Secret runtime sin imprimir sus valores..."
kubectl create secret generic yousac-runtime \
  --namespace "$NAMESPACE" \
  --from-literal=JWT_SECRET="$K8S_JWT_SECRET" \
  --from-literal=DATABASE_URL_AUTH="$K8S_DATABASE_URL_AUTH" \
  --from-literal=DATABASE_URL_CATALOG="$K8S_DATABASE_URL_CATALOG" \
  --from-literal=DATABASE_URL_REPRODUCCION="$K8S_DATABASE_URL_REPRODUCCION" \
  --from-literal=DATABASE_URL_ANALITICA="$K8S_DATABASE_URL_ANALITICA" \
  --from-literal=DATABASE_URL_INSCRIPCION="$K8S_DATABASE_URL_INSCRIPCION" \
  --from-literal=DATABASE_URL_NOTIFICACIONES="$K8S_DATABASE_URL_NOTIFICACIONES" \
  --from-literal=REDIS_URL="$K8S_REDIS_URL" \
  --from-literal=GOOGLE_CLIENT_ID="$K8S_GOOGLE_CLIENT_ID" \
  --from-literal=GOOGLE_CLIENT_SECRET="$K8S_GOOGLE_CLIENT_SECRET" \
  --from-literal=YOUTUBE_API_KEY="$K8S_YOUTUBE_API_KEY" \
  --from-literal=SMTP_USER="$K8S_SMTP_USER" \
  --from-literal=SMTP_PASS="$K8S_SMTP_PASS" \
  --from-literal=SMTP_FROM="$K8S_SMTP_FROM" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Validando el render de Kustomize..."
kubectl kustomize "$production_dir" > "$rendered_file"

if grep -Eq '__REQUIRED_|type:[[:space:]]*(NodePort|LoadBalancer)' "$rendered_file"; then
  echo "ERROR: el render contiene placeholders o un Service prohibido." >&2
  exit 1
fi

while IFS= read -r image; do
  case "$image" in
    "$REGISTRY_BASE"/*:*) ;;
    gcr.io/cloud-sql-connectors/cloud-sql-proxy:*) ;;
    *)
      echo "ERROR: imagen fuera de Artifact Registry: $image" >&2
      exit 1
      ;;
  esac
done < <(awk '$1 == "image:" { print $2 }' "$rendered_file")

echo "Aplicando manifests de producción..."
kubectl apply -k "$production_dir"

deployments=(
  frontend
  api-gateway
  auth-service
  catalog-service
  reproduccion-service
  analitica-service
  inscripcion-service
  notificaciones-service
)

for deployment in "${deployments[@]}"; do
  echo "Esperando rollout de deployment/$deployment..."
  kubectl rollout status "deployment/$deployment" \
    --namespace "$NAMESPACE" \
    --timeout=10m
done

echo "Esperando que el ManagedCertificate quede Active..."
certificate_status=""
for attempt in {1..30}; do
  certificate_status="$(kubectl get managedcertificate yousac-managed-cert \
    --namespace "$NAMESPACE" \
    -o jsonpath='{.status.certificateStatus}' 2>/dev/null || true)"
  if [[ "$certificate_status" == "Active" ]]; then
    break
  fi
  echo "Certificado todavía no está Active (estado: ${certificate_status:-pendiente}; intento $attempt/30)."
  sleep 20
done
if [[ "$certificate_status" != "Active" ]]; then
  echo "ERROR: el ManagedCertificate no llegó a Active." >&2
  kubectl describe managedcertificate yousac-managed-cert --namespace "$NAMESPACE" >&2 || true
  exit 1
fi

echo "Esperando que los backends del Ingress queden HEALTHY..."
ingress_backends=""
for attempt in {1..36}; do
  ingress_backends="$(kubectl get ingress yousac-public \
    --namespace "$NAMESPACE" \
    -o json 2>/dev/null \
    | jq -r '.metadata.annotations["ingress.kubernetes.io/backends"] // "{}"' \
    2>/dev/null || true)"

  if [[ -n "$ingress_backends" ]] && jq -e \
      'type == "object" and length > 0 and all(.[]; . == "HEALTHY")' \
      <<<"$ingress_backends" >/dev/null 2>&1; then
    echo "Backends del Ingress saludables: $ingress_backends"
    break
  fi

  echo "Backends del Ingress todavía no están HEALTHY (intento $attempt/36): ${ingress_backends:-pendiente}."
  sleep 5
done

if ! jq -e \
    'type == "object" and length > 0 and all(.[]; . == "HEALTHY")' \
    <<<"${ingress_backends:-{}}" >/dev/null 2>&1; then
  echo "ERROR: los backends del Ingress no llegaron a HEALTHY." >&2
  kubectl describe ingress yousac-public --namespace "$NAMESPACE" >&2 || true
  exit 1
fi

base_url="https://$DOMAIN"
echo "Ejecutando smoke tests contra $base_url..."
smoke_test() {
  local path="$1"
  echo "Smoke test: $path"
  curl --fail --silent --show-error \
    --retry 36 --retry-delay 5 --retry-max-time 180 --retry-all-errors \
    "$base_url$path"
  echo
}

smoke_test "/"
smoke_test "/healthz"
smoke_test "/api/health"

echo "Despliegue de $IMAGE_TAG completado en $base_url"
