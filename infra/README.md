# Infraestructura como código — YoUSAC Fase 3

Este directorio reúne el aprovisionamiento de GCP con Terraform y la configuración de hosts con Ansible. La guía de operación paso a paso está en [Manual_Despliegue_Fase3.md](../Documentacion/Manual_Despliegue_Fase3.md).

## Topología declarada

Terraform declara la VPC vpc-yousac (10.20.0.0/16), tres subredes (perimetral 10.20.1.0/24, aplicación 10.20.2.0/24 y datos 10.20.3.0/24), Cloud Router/NAT, firewall, dos VMs privadas con acceso por IAP y peering bidireccional a la red default.

| Recurso | Función |
|---|---|
| vm-dev-yousac | Entorno de desarrollo con Docker/Compose, en subnet-yousac-aplicacion (10.20.2.10). |
| vm-observability-yousac | Elasticsearch, Logstash y Kibana, en subnet-yousac-datos (10.20.3.10). |
| yousac-prod | Clúster GKE Autopilot preexistente, adoptado con bloques import. Permanece en la red default; no se migra a vpc-yousac. |
| yousac-p6-db | Instancia Cloud SQL preexistente adoptada por Terraform. Los workloads utilizan Cloud SQL Auth Proxy/Workload Identity; no abrir acceso de base de datos a Internet. |
| yousac-videos / yousac-material | Buckets existentes adoptados para los medios y materiales. |
| yousac (Artifact Registry) | Repositorio existente adoptado para imágenes de los servicios. |
| yousac-prod-ip | Dirección estática preexistente adoptada para el Ingress. |

El Redis predeterminado configurado por deploy/gke-preflight.sh es una VM preexistente yousac-vm-nube en la red default. No forma parte de las dos VMs declaradas por este módulo.

## Terraform

- Requiere Terraform 1.6 o superior y credenciales Application Default de gcloud.
- El backend remoto GCS utiliza el bucket yousac-tfstate y el prefijo terraform/state. El bucket debe existir y tener IAM restringido antes de terraform init.
- Los bloques import permiten administrar recursos GCP preexistentes sin recrearlos; aun así, revisar siempre terraform plan antes de aplicar y detenerse si aparecen reemplazos o borrados imprevistos.
- La contraseña de Cloud SQL se inyecta con TF_VAR_postgres_password; no guardarla en tfvars ni imprimirla. El valor puede persistir en el estado, por lo que el backend y sus permisos requieren protección.
- El archivo Terraform ansible.tf genera inventory.ini y un null_resource puede ejecutar el playbook Ansible durante terraform apply. Antes de aplicar, tener Ansible, llave SSH, IAP y secretos ELK configurados.
- No ejecutar terraform destroy como procedimiento rutinario: el estado combina recursos nuevos y recursos productivos adoptados.

## Ansible

El playbook site.yml compone los siguientes pasos:

1. Configuración base y hardening de las VMs.
2. Docker Engine y Docker Compose en la VM de desarrollo.
3. node-exporter y Fluent Bit en las VMs.
4. Elasticsearch, Logstash y Kibana en la VM de observabilidad.

Ansible usa el inventario generado por Terraform y túneles IAP; inventory.ini y group_vars/all/secrets.yml son archivos locales ignorados por Git. Las plantillas *.example sí se versionan. Revisar [Manual de despliegue](../Documentacion/Manual_Despliegue_Fase3.md) antes de hacer cambios en infraestructura.

## Validación segura

~~~powershell
Set-Location infra/terraform
terraform init
terraform validate
terraform plan

Set-Location ../ansible
ansible-playbook --syntax-check -i inventory.ini site.yml
ansible-playbook --check --diff -i inventory.ini site.yml
~~~

Estas validaciones no sustituyen la revisión de cambios del plan ni confirman por sí solas que los servicios estén activos en GCP. La comprobación de estado de Kubernetes/servicios se describe en el manual de despliegue.
