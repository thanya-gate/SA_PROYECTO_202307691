# YoUSAC

Plataforma académica de la Universidad de San Carlos de Guatemala basada en
un API Gateway, frontend y seis microservicios con gRPC.

## Entornos

- Desarrollo/staging: Docker Compose en la VM, conservado para la Práctica 6.
- Producción: Kubernetes sobre GKE Autopilot, organizado con Kustomize.

La configuración de Kubernetes, Cloud SQL Proxy, Workload Identity, secretos,
preflight, rollback y requisitos de GCP está en
[k8s/README.md](k8s/README.md). El pipeline completo está documentado en
[Documentacion/CI_CD.md](Documentacion/CI_CD.md).

## URL pública de producción

`https://yousac-thany.duckdns.org`

La URL y el certificado administrado quedan sujetos a la configuración real de
GKE, la IP global y el registro DNS. La evidencia de una ejecución exitosa se
agregará después del primer despliegue validado.

## Desarrollo local

```bash
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.local.yml up --build -d
```

Gateway: `http://localhost:8080` · frontend: `http://localhost:8081`.
