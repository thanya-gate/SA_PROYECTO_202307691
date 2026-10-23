# YoUSAC · Observabilidad (Prometheus + Grafana sobre GKE Autopilot)

Prometheus (kube-prometheus-stack) recolecta métricas del clúster `yousac-prod` y del
api-gateway; Grafana las muestra públicamente en modo solo lectura.

- Grafana: <https://grafana.yousac-thany.duckdns.org> (Viewer anónimo; admin en el Secret `grafana-admin`).
- Logs en ELK (Kibana): [recolector GKE y rotación Docker](fluent-bit/README.md), [evidencia](fluent-bit/evidence/VERIFICACION.md) y dashboards en `kibana-dashboards/`.

| Dashboard | Qué mide |
|---|---|
| YoUSAC · Infraestructura | Nodos listos, pods por fase, CPU/RAM por nodo y por pod, reinicios, réplicas disponibles |
| YoUSAC · Negocio y Tareas | Reproducciones activas, aciertos de Redis, req/s y % 5xx del Ingress, tráfico `/federation`, latencia p95 HTTP y gRPC, estado de los 3 CronJobs |

## Fuentes de métricas

| Target | Origen | Métricas clave |
|---|---|---|
| `kubelet` (+ `/metrics/cadvisor`) | ServiceMonitor del chart | `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes` |
| `kube-state-metrics` | chart | `kube_node_*`, `kube_pod_status_phase`, `kube_cronjob_*`, `kube_job_*` |
| `api-gateway` | `gateway-servicemonitor.yaml` → `GET /metrics` (prom-client, `Backend/api-gateway/src/metrics.ts`) | `http_requests_total`, `http_request_duration_seconds`, `grpc_client_duration_seconds`, `yousac_reproducciones_activas` |
| `redis-exporter` | `redis-exporter.yaml` (lee `REDIS_URL` del secret `yousac-runtime`) | `redis_keyspace_hits_total`, `redis_keyspace_misses_total` |

`/metrics` del gateway no es público: el Ingress solo enruta `/api`, `/mock-oauth` y `/federation`.

### Particularidades de GKE Autopilot

- **Sin node-exporter**: Autopilot rechaza DaemonSets con `hostNetwork`/`hostPath`; las métricas de nodo salen de kubelet/cAdvisor.
- **Sin componentes del plano de control** (etcd, scheduler, controller-manager, kube-proxy, CoreDNS): GKE los administra.
- **`kube-system` es de solo lectura**: el Service del kubelet se publica en `monitoring` (`prometheusOperator.kubeletService.namespace` y `kubelet.namespace`).
- **Grafana en `yousac-prod`** (`grafana.namespaceOverride`): un Ingress GCE no apunta a Services de otro namespace, así que Grafana cuelga del Ingress `yousac-public` con el `BackendConfig` `grafana-backendconfig` (sonda `/api/health`).

## Despliegue (manual, una vez; el CD no lo hace)

```bash
# 1. Contraseña de admin (no se versiona)
kubectl create secret generic grafana-admin -n yousac-prod \
  --from-literal=admin-user=admin --from-literal=admin-password="$(openssl rand -base64 18)"
# Leerla: kubectl get secret grafana-admin -n yousac-prod -o jsonpath='{.data.admin-password}' | base64 -d

# 2. Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace --version 92.3.0 -f observability/grafana-values.yaml --wait

# 3. ServiceMonitors, redis-exporter, BackendConfig y dashboards (namespace yousac-prod)
kubectl apply -k observability
```

El host `grafana.yousac-thany.duckdns.org` está en `k8s/overlays/production/ingress.yaml` y en
`managed-certificate.yaml`. Al cambiar los dominios del `ManagedCertificate`, GKE emite un certificado
nuevo y **HTTPS deja de responder en todos los dominios** hasta que queda `Active` (de 15 a 60 min).

Los dashboards se generan como ConfigMaps con la etiqueta `grafana_dashboard: "1"`; el sidecar de Grafana los importa solo.

## Verificar

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# http://localhost:9090/targets → kubelet, kube-state-metrics, api-gateway y redis-exporter en "up"
```

Para ver los tableros con tráfico: `curl -H "X-API-Key: <key>" https://yousac-thany.duckdns.org/federation/v1/clases`
en bucle y reproducir clases desde la app.
