# Infraestructura como código (Terraform + Ansible)

Traído desde la Práctica 9 (`SA_PRACTICA_202307691/Practica9/infra`) como punto de partida para la Fase 3.
**Todavía describe la infraestructura de Academix Pass**, no la de YoUSAC.

> ⚠️ No ejecutar `terraform apply` desde aquí hasta adaptarlo. El estado de la Práctica 9 no viaja con estos
> archivos, así que Terraform intentaría crear de nuevo `vpc-academix-pass` y las VMs que ya existen.

| Carpeta | Contenido actual |
|---|---|
| `terraform/` | VPC `vpc-academix-pass`, subredes `development`/`production`, firewall, 2 VMs y generación del inventario de Ansible |
| `ansible/` | Roles `base` (paquetes, usuario de despliegue, hardening SSH), `docker` (Docker + Compose) y `k3s` |

## Qué falta adaptar para YoUSAC (Fase 3)

**Terraform**
- VPC propia de YoUSAC con 3 subredes: perímetro (Ingress), aplicación (nodos/pods) y datos.
- Clúster GKE (`google_container_cluster` + node pool) en la subred de aplicación.
- Cloud SQL con IP privada (`google_sql_database_instance` + private service access) en la subred de datos.
- Redis gestionado o VM de datos fuera del clúster.
- Buckets `yousac-videos` y `yousac-material` con sus políticas IAM.
- VM de desarrollo con Docker Compose.
- Backend de estado remoto en un bucket GCS (no en local).

**Ansible**
- Agente de métricas (node-exporter) y recolector de logs (Filebeat o Fluent Bit hacia Logstash) en las VMs.

## Validación

```bash
cd infra/terraform && terraform init -backend=false && terraform validate
cd infra/ansible && ansible-playbook --syntax-check -i inventory.ini.example site.yml
```
