#!/usr/bin/env bash

# Preflight de solo lectura para los recursos que deben existir antes del
# primer despliegue. No crea clústeres, cambia DNS, modifica IAM ni altera
# kubeconfig.

set -Eeuo pipefail

readonly PROJECT_ID="${GCP_PROJECT_ID:-yousac-202300396-2026}"
readonly REGION="${GCP_REGION:-us-central1}"
readonly CLUSTER_NAME="${GKE_CLUSTER_NAME:-yousac-prod}"
readonly NAMESPACE="${K8S_NAMESPACE:-yousac-prod}"
readonly DOMAIN="${K8S_DOMAIN:-yousac-thany.duckdns.org}"
readonly STATIC_IP_NAME="${GKE_STATIC_IP_NAME:-yousac-prod-ip}"
readonly CLOUDSQL_GSA="${CLOUDSQL_GSA:-yousac-cloudsql-proxy@${PROJECT_ID}.iam.gserviceaccount.com}"
readonly GATEWAY_GSA="${GATEWAY_GSA:-yousac-gateway-storage@${PROJECT_ID}.iam.gserviceaccount.com}"
readonly REDIS_MODE="${REDIS_MODE:-vm}"
readonly REDIS_VM_NAME="${REDIS_VM_NAME:-yousac-vm-nube}"
readonly REDIS_VM_ZONE="${REDIS_VM_ZONE:-us-central1-a}"
readonly REDIS_VM_IP="${REDIS_VM_IP:-10.128.0.3}"
readonly REDIS_VM_PORT="${REDIS_VM_PORT:-6379}"
readonly MEMORYSTORE_INSTANCE_NAME="${MEMORYSTORE_INSTANCE_NAME:-}"
readonly BUCKET_VIDEOS="${GCS_BUCKET_VIDEOS:-yousac-videos}"
readonly BUCKET_MATERIAL="${GCS_BUCKET_MATERIAL:-yousac-material}"

for variable in \
  CLOUD_SQL_CONNECTION_NAME_AUTH \
  CLOUD_SQL_CONNECTION_NAME_CATALOG \
  CLOUD_SQL_CONNECTION_NAME_REPRODUCCION \
  CLOUD_SQL_CONNECTION_NAME_ANALITICA \
  CLOUD_SQL_CONNECTION_NAME_INSCRIPCION \
  CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES; do
  if [[ -z "${!variable:-}" ]]; then
    echo "ERROR: falta $variable con formato proyecto:region:instancia." >&2
    exit 1
  fi
done

case "$REDIS_MODE" in
  vm)
    [[ -n "$REDIS_VM_IP" ]] || {
      echo "ERROR: falta REDIS_VM_IP para verificar Redis en la VM." >&2
      exit 1
    }
    ;;
  memorystore)
    [[ -n "$MEMORYSTORE_INSTANCE_NAME" ]] || {
      echo "ERROR: falta MEMORYSTORE_INSTANCE_NAME para verificar Memorystore." >&2
      exit 1
    }
    ;;
  *)
    echo "ERROR: REDIS_MODE debe ser 'vm' o 'memorystore' (recibido: $REDIS_MODE)." >&2
    exit 1
    ;;
esac

command -v gcloud >/dev/null 2>&1 || {
  echo "ERROR: gcloud CLI no está instalado." >&2
  exit 1
}
command -v kubectl >/dev/null 2>&1 || {
  echo "ERROR: kubectl no está instalado." >&2
  exit 1
}
command -v jq >/dev/null 2>&1 || {
  echo "ERROR: jq es obligatorio para validar las políticas IAM de Cloud Storage." >&2
  exit 1
}

echo "== Proyecto y clúster =="
cluster_status="$(gcloud container clusters describe "$CLUSTER_NAME" \
  --region "$REGION" --project "$PROJECT_ID" --format='value(status)')"
[[ "$cluster_status" == "RUNNING" ]] || {
  echo "ERROR: el clúster $CLUSTER_NAME no está RUNNING (estado: $cluster_status)." >&2
  exit 1
}
autopilot="$(gcloud container clusters describe "$CLUSTER_NAME" \
  --region "$REGION" --project "$PROJECT_ID" --format='value(autopilot.enabled)')"
[[ "$autopilot" == "True" || "$autopilot" == "true" ]] || {
  echo "ERROR: $CLUSTER_NAME existe, pero no está configurado como Autopilot." >&2
  exit 1
}
cluster_network="$(gcloud container clusters describe "$CLUSTER_NAME" \
  --region "$REGION" --project "$PROJECT_ID" --format='value(network)')"
cluster_network_name="${cluster_network##*/}"
echo "Clúster Autopilot RUNNING: $CLUSTER_NAME ($cluster_network)"

echo "== Acceso al contexto Kubernetes =="
kubectl version --request-timeout=10s >/dev/null
if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  echo "Contexto Kubernetes accesible y namespace presente: $NAMESPACE"
else
  echo "Contexto Kubernetes accesible; el namespace $NAMESPACE todavía no existe y lo creará el CD."
fi

echo "== IP global y DNS =="
static_ip="$(gcloud compute addresses describe "$STATIC_IP_NAME" \
  --global --project "$PROJECT_ID" --format='value(address)')"
[[ -n "$static_ip" ]] || {
  echo "ERROR: no se obtuvo una IP para la dirección global $STATIC_IP_NAME." >&2
  exit 1
}

if command -v dig >/dev/null 2>&1; then
  dns_ip="$(dig +short A "$DOMAIN" | awk 'NF { value=$1 } END { print value }')"
else
  dns_ip="$(nslookup "$DOMAIN" 2>/dev/null | awk '/^Address: / { value=$2 } END { print value }')"
fi
[[ "$dns_ip" == "$static_ip" ]] || {
  echo "ERROR: $DOMAIN resuelve a '$dns_ip'; debe resolver a '$static_ip'." >&2
  exit 1
}
echo "DNS correcto: $DOMAIN -> $static_ip"

echo "== Cloud SQL y Workload Identity runtime =="
for variable in \
  CLOUD_SQL_CONNECTION_NAME_AUTH \
  CLOUD_SQL_CONNECTION_NAME_CATALOG \
  CLOUD_SQL_CONNECTION_NAME_REPRODUCCION \
  CLOUD_SQL_CONNECTION_NAME_ANALITICA \
  CLOUD_SQL_CONNECTION_NAME_INSCRIPCION \
  CLOUD_SQL_CONNECTION_NAME_NOTIFICACIONES; do
  connection_name="${!variable}"
  instance_name="${connection_name##*:}"
  gcloud sql instances describe "$instance_name" --project "$PROJECT_ID" \
    --format='value(state,connectionName)' >/dev/null
  echo "$variable verificada: $connection_name"
done
gcloud iam service-accounts describe "$CLOUDSQL_GSA" --project "$PROJECT_ID" >/dev/null
gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten='bindings[].members' \
  --filter="bindings.role=roles/cloudsql.client AND bindings.members=serviceAccount:$CLOUDSQL_GSA" \
  --format='value(bindings.role)' | grep -qx 'roles/cloudsql.client' || {
    echo "ERROR: $CLOUDSQL_GSA no tiene roles/cloudsql.client en $PROJECT_ID." >&2
    exit 1
  }
echo "Cloud SQL Auth Proxy autorizado con $CLOUDSQL_GSA"

echo "== Redis =="
case "$REDIS_MODE" in
  vm)
    vm_status="$(gcloud compute instances describe "$REDIS_VM_NAME" \
      --zone "$REDIS_VM_ZONE" --project "$PROJECT_ID" --format='value(status)')"
    [[ "$vm_status" == "RUNNING" ]] || {
      echo "ERROR: la VM Redis $REDIS_VM_NAME no está RUNNING (estado: $vm_status)." >&2
      exit 1
    }
    vm_network="$(gcloud compute instances describe "$REDIS_VM_NAME" \
      --zone "$REDIS_VM_ZONE" --project "$PROJECT_ID" --format='value(networkInterfaces[0].network)')"
    vm_ip="$(gcloud compute instances describe "$REDIS_VM_NAME" \
      --zone "$REDIS_VM_ZONE" --project "$PROJECT_ID" --format='value(networkInterfaces[0].networkIP)')"
    [[ "$vm_ip" == "$REDIS_VM_IP" ]] || {
      echo "ERROR: la VM Redis tiene IP '$vm_ip'; se esperaba '$REDIS_VM_IP'." >&2
      exit 1
    }
    vm_network_name="${vm_network##*/}"
    [[ "$cluster_network_name" == "$vm_network_name" ]] || {
      echo "ERROR: Redis usa la red '$vm_network_name', pero GKE usa '$cluster_network_name'." >&2
      exit 1
    }
    echo "Redis externo en VM disponible: $REDIS_VM_NAME ($REDIS_VM_IP:$REDIS_VM_PORT)."
    echo "La conectividad TCP se probará desde un pod temporal cuando existan workloads."
    ;;
  memorystore)
    redis_description="$(gcloud redis instances describe "$MEMORYSTORE_INSTANCE_NAME" \
      --region "$REGION" --project "$PROJECT_ID" \
      --format='value(state,connectMode,authorizedNetwork,host,port)')"
    [[ -n "$redis_description" ]] || {
      echo "ERROR: no se pudo describir Memorystore/$MEMORYSTORE_INSTANCE_NAME." >&2
      exit 1
    }
    redis_state="$(gcloud redis instances describe "$MEMORYSTORE_INSTANCE_NAME" \
      --region "$REGION" --project "$PROJECT_ID" --format='value(state)')"
    [[ "$redis_state" == "READY" ]] || {
      echo "ERROR: Memorystore/$MEMORYSTORE_INSTANCE_NAME no está READY (estado: $redis_state)." >&2
      exit 1
    }
    redis_network="$(gcloud redis instances describe "$MEMORYSTORE_INSTANCE_NAME" \
      --region "$REGION" --project "$PROJECT_ID" --format='value(authorizedNetwork)')"
    redis_network_name="${redis_network##*/}"
    if [[ -n "$redis_network_name" && "$cluster_network_name" != "$redis_network_name" ]]; then
      echo "ERROR: Memorystore usa la red '$redis_network_name', pero GKE usa '$cluster_network_name'." >&2
      exit 1
    fi
    echo "Memorystore disponible: $redis_description"
    echo "La conectividad al host/puerto se valida desde un pod de GKE durante la prueba de aceptación."
    ;;
esac

echo "== Cloud Storage y cuenta del Gateway =="
gcloud iam service-accounts describe "$GATEWAY_GSA" --project "$PROJECT_ID" >/dev/null
gcloud storage buckets describe "gs://$BUCKET_VIDEOS" --project "$PROJECT_ID" >/dev/null
gcloud storage buckets describe "gs://$BUCKET_MATERIAL" --project "$PROJECT_ID" >/dev/null
for bucket in "$BUCKET_VIDEOS" "$BUCKET_MATERIAL"; do
  bucket_policy="$(gcloud storage buckets get-iam-policy "gs://$bucket" \
    --project "$PROJECT_ID" --format='json(bindings)')"
  if ! jq -e --arg member "serviceAccount:$GATEWAY_GSA" \
      '.bindings[]? | select(.role == "roles/storage.objectAdmin") | .members[]? | select(. == $member)' \
      <<<"$bucket_policy" >/dev/null; then
    echo "ERROR: $GATEWAY_GSA no tiene roles/storage.objectAdmin sobre gs://$bucket." >&2
    exit 1
  fi
done
echo "Buckets disponibles: gs://$BUCKET_VIDEOS y gs://$BUCKET_MATERIAL"
echo "Cuenta del Gateway existente: $GATEWAY_GSA"

echo "Preflight completado: no se encontraron bloqueos para iniciar el CD."
