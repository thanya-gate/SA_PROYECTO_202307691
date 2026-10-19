# Academix · Observabilidad (Prometheus + Grafana sobre K3s)

> **Origen:** copiado desde `SA_PRACTICA_202307691/Practica10/deploy/observability` como base para la Fase 3.
> Hoy monitorea Academix sobre K3s (Traefik, RabbitMQ). Para YoUSAC falta: desplegarlo en GKE (sin Traefik
> ni middlewares de Traefik), cambiar los tableros a *Infraestructura YoUSAC* y *Negocio y Tareas*
> (reproducciones activas, ejecución de cronjobs, tráfico federado), y agregar latencia gRPC y aciertos de Redis.


Monitoreo y dashboards para la Práctica 10. Cubre la sección de
**Observabilidad** del documento: Prometheus scrapea métricas de RabbitMQ
(plugin `rabbitmq_prometheus`), de Traefik (Ingress) y de Kubernetes, y Grafana
muestra tres dashboards:

| Dashboard | Qué mide |
|---|---|
| Academix · Infraestructura | CPU/memoria de pods, nodos listos, pods por fase, tráfico de red |
| Academix · Negocio y Colas | Longitud de cola de solicitudes, tasas de publicación/consumo, tickets emitidos (acumulado) |
| Academix · Ingress y Experiencia de Usuario (extra) | Peticiones/s por servicio, latencia p95/p99, códigos HTTP, % de 5xx, disponibilidad vs. SLO 99%, reinicios de contenedores |

El tercer tablero demuestra el punto 4 del enunciado: durante la ráfaga la cola sube
(tablero 2) mientras la latencia y los errores del Ingress se mantienen estables.

**Estado: desplegado y verificado.**

- Grafana público (solo lectura, sin login): <https://grafana.academix.34.123.206.113.sslip.io>
- Los 12 paneles de los 2 dashboards devuelven datos (comprobado con `/api/ds/query`).

## 1. Crear la contraseña de admin (una sola vez)

La contraseña no se versiona: vive en un Secret que el chart lee con `admin.existingSecret`.

```bash
kubectl create secret generic grafana-admin -n monitoring \
  --from-literal=admin-user=admin --from-literal=admin-password="$(openssl rand -base64 18)"
# Para leerla: kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d
```

## 2. Instalar / actualizar el stack

Todos los valores están en `grafana-values.yaml` (Grafana habilitado, acceso anónimo
Viewer, datasource con `uid: prometheus`, sidecar de dashboards, Alertmanager deshabilitado).

```bash
export KUBECONFIG=Practica9/infra/ansible/kubeconfig/k3s.yaml
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace --version 92.3.0 -f Practica10/deploy/observability/grafana-values.yaml --wait
kubectl apply -k Practica10/deploy/observability   # ServiceMonitor, dashboards, Ingress + TLS
```

El sidecar de Grafana importa automáticamente todo ConfigMap con la etiqueta
`grafana_dashboard: "1"` del namespace `monitoring`.

> **Nota sobre las métricas de colas:** `rabbitmq_prometheus` expone por defecto las
> métricas **agregadas** (sin la etiqueta `queue`). Por eso los paneles usan
> `sum(rabbitmq_queue_messages)` en lugar de filtrar por cola: el filtro
> `{queue="..."}` devolvía series vacías.

## 3. Verificar

```powershell
kubectl get servicemonitors -n monitoring
# Targets esperados en Prometheus (Status → Targets):
#   rabbitmq           up   (métricas del broker, :15692/metrics)
#   node-exporter      up   (recursos del nodo K3s)
#   kube-state-metrics up   (estado de pods/nodos)
#   traefik            up   (PodMonitor, :9100/metrics del pod de Traefik en kube-system)
kubectl port-forward svc/kube-prometheus-stack-prometheus -n monitoring 9090:9090
# → http://localhost:9090
```

Métricas relevantes del broker (RabbitMQ 3.13, plugin `rabbitmq_prometheus`):

| Métrica | Qué mide |
|---|---|
| `sum(rabbitmq_queue_messages)` | Mensajes encolados (agregado de todas las colas) |
| `rate(rabbitmq_channel_messages_published_total[1m])` | Tasa de publicación (tickets emitidos/s) |
| `rate(rabbitmq_channel_messages_acked_total[1m])` | Tasa de consumo de los workers |
| `sum(rabbitmq_queue_messages_unacked)` | Mensajes sin acuse (backlog en consumidores) |

## 4. Cuándo se actualiza el host

Si se recrea la VM y cambia la IP pública, actualizar `grafana.academix.<IP>.sslip.io`
en `grafana-ingress.yaml` (host, `dnsNames` y regla) y en los accesos del README.