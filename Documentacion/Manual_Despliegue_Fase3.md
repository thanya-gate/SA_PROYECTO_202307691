# Manual de despliegue — YoUSAC, Fase 3

Esta guía describe el aprovisionamiento de infraestructura, la configuración de las VMs y el despliegue de la aplicación en GKE. Está escrita contra los archivos actuales del repositorio. No significa que se haya ejecutado Terraform ni que el estado remoto/cloud haya sido verificado durante esta revisión.

## 1. Topología y destinos

- **GKE de producción:** clúster Autopilot existente yousac-prod, namespace yousac-prod, en la red default. Terraform lo adopta mediante bloques import; no se crea dentro de vpc-yousac.
- **VPC propia:** vpc-yousac (10.20.0.0/16), con subredes perimetral (10.20.1.0/24), aplicación (10.20.2.0/24) y datos (10.20.3.0/24), Cloud Router/NAT y peering a la red default.
- **VM de desarrollo:** vm-dev-yousac, IP interna 10.20.2.10, Docker/Compose; acceso SSH por IAP.
- **VM de observabilidad:** vm-observability-yousac, IP interna 10.20.3.10, Elasticsearch, Logstash y Kibana; acceso por IAP.
- **Recursos existentes adoptados:** GKE, Cloud SQL, buckets de video/material, Artifact Registry y la IP estática. La instancia de Cloud SQL conserva IPv4 pública habilitada, pero no autoriza rangos de cliente; la aplicación se conecta mediante Cloud SQL Auth Proxy/Workload Identity.
- **Redis de GKE:** el preflight del despliegue usa por defecto la VM externa yousac-vm-nube en la red default. No es una VM creada por el módulo Terraform de vpc-yousac.

La [composición 4+1 de Fase 3](Practica7/Vistas4+1/Vista4+1_Practica7_G4.drawio.svg) y sus cinco fuentes editables están en `Practica7/Vistas4+1/` y `Practica7/Vistas4+1/XML/`; el [diagrama de alto nivel, CI/CD y flujos detallados](../docs/fase3/diagramas/) complementa esas vistas. Las diferencias entre la VPC propia y la red del clúster son intencionales y deben conservarse al seguir esta guía.

## 2. Requisitos previos

En la estación de despliegue se requieren:

- Acceso autorizado al proyecto GCP yousac-202300396-2026, permisos de Compute/Networking, GKE, Cloud SQL, IAM, Artifact Registry y acceso IAP según el paso que se vaya a ejecutar.
- Google Cloud CLI (gcloud) autenticado, Terraform **1.6 o superior**, Ansible, kubectl, Git y OpenSSH.
- La llave SSH privada correspondiente a la llave pública autorizada en las VMs. No copiar la llave privada al repositorio.
- Acceso al bucket remoto de estado yousac-tfstate. El bucket debe existir antes de terraform init; limitar su IAM al equipo de infraestructura y proteger/versionar los objetos de estado.
- Para el despliegue de GKE desde GitHub Actions: secretos/variables de WIF, Artifact Registry, runtime y smoke tests configurados según [CI_CD.md](CI_CD.md) y [k8s/README.md](../k8s/README.md).

Las versiones de herramientas en esta guía son prerequisitos operativos; confirmar las versiones instaladas con terraform version, gcloud version, ansible --version y kubectl version --client.

## 3. Secretos y configuración

Usar las plantillas versionadas y completar valores solamente en el entorno seguro:

- [Plantilla de entorno para Compose](../.env.cloud.example): copiar como .env.cloud en la VM y completar según el destino.
- [Variables de Terraform](../infra/terraform/terraform.tfvars.example): copiar como terraform.tfvars solo si es necesario cambiar los valores por defecto.
- [Secretos Ansible](../infra/ansible/group_vars/all/secrets.yml.example): copiar como secrets.yml y completar credenciales de Elasticsearch/Kibana.
- Para GKE, consultar los nombres requeridos de secrets y variables en [k8s/README.md](../k8s/README.md) y [CI_CD.md](CI_CD.md).

No subir .env.cloud, terraform.tfvars, archivos secrets.yml, llaves SSH, credenciales JSON, .tfstate, backups ni archivos de plan. El estado de Terraform contiene datos sensibles aunque una variable esté marcada sensitive; no imprimirlo ni compartirlo. La contraseña de Cloud SQL se entrega al proceso de Terraform mediante la variable de entorno TF_VAR_postgres_password desde un gestor seguro, nunca como argumento literal de consola o dentro del .tfvars.

## 4. Aprovisionar infraestructura con Terraform

### 4.1 Revisiones previas

1. Verificar el proyecto activo y la identidad de gcloud.
2. Confirmar que yousac-tfstate existe y que la cuenta tiene acceso.
3. Revisar las llaves públicas configuradas en ssh_public_key_paths y verificar que los archivos existen localmente.
4. Asegurar que Ansible, la llave privada, el acceso IAP y los secretos ELK están listos: durante terraform apply, la configuración del repositorio puede invocar Ansible localmente.
5. No descargar, editar ni regenerar el estado remoto para “arreglar” diferencias sin autorización del responsable de infraestructura.

### 4.2 Inicializar y generar el plan

Desde PowerShell, en la raíz del repositorio:

~~~powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project yousac-202300396-2026

Set-Location infra/terraform
terraform init
terraform validate
terraform plan
~~~

El backend GCS está declarado en versions.tf. No usar -backend=false para un plan de recursos reales: produciría un plan sin el estado compartido y podría proponer recrear infraestructura existente.

### 4.3 Revisar y aplicar

Leer el plan completo antes de aprobar. Identificar especialmente cualquier acción de reemplazo o borrado, cambios de red, peering, firewall, máquinas, bucket, GKE o Cloud SQL. Los recursos importados y los recursos nuevos aparecen juntos en el módulo. Si el plan propone una destrucción/recreación inesperada, **detenerse y no aplicar**; consultar al responsable y reconciliar el estado/código primero.

Solo cuando el plan haya sido revisado y aprobado por el responsable:

~~~powershell
terraform apply
terraform output
~~~

Terraform solicita confirmación antes de ejecutar. El apply puede configurar las VMs mediante Ansible, así que un fallo del provisionador requiere revisar el error concreto antes de repetirlo. No ejecutar terraform destroy como método de reinicio: el estado incluye recursos productivos adoptados y recursos compartidos.

## 5. Configurar las VMs con Ansible

El playbook principal ejecuta, en orden, configuración base, Docker en la VM de desarrollo, agentes node-exporter/Fluent Bit y el stack ELK en la VM de observabilidad. Terraform genera infra/ansible/inventory.ini; ese inventario es local e ignorado por Git. SSH se establece por túnel IAP.

Si se requiere una ejecución controlada, primero validar sintaxis y modo de comprobación:

~~~powershell
Set-Location ../ansible
ansible-playbook --syntax-check -i inventory.ini site.yml
ansible-playbook --check --diff -i inventory.ini site.yml
~~~

El modo --check no siempre predice efectos de todas las tareas/comandos. Ejecutar el playbook real solo con aprobación y conectividad confirmada:

~~~powershell
ansible-playbook -i inventory.ini site.yml
~~~

Para diagnóstico sin cambios, consultar conectividad IAP, inventario, estado de servicios Docker/ELK y logs de Ansible. No copiar la llave privada ni secrets.yml a una carpeta versionada.

## 6. Desplegar la aplicación en GKE

El flujo previsto es GitHub Actions; el workflow ci-cd.yml construye y publica ocho imágenes con etiquetas inmutables commit-<SHA>. El despliegue de producción a GKE se ejecuta con un push a main o con ejecución manual desde main, después de las pruebas/publicación. Un pull request no despliega a producción. Los tags de release publican las imágenes y actualizan la VM, pero el job de GKE se condiciona a main.

1. Configurar los secretos y variables de GitHub enumerados en [CI_CD.md](CI_CD.md) y [k8s/README.md](../k8s/README.md). No guardar secretos en YAML, variables públicas del frontend ni en el repositorio.
2. Revisar que el cambio esté integrado en main según la política del equipo.
3. Consultar **GitHub > Actions > CI/CD — Pruebas, publicación y despliegue** y confirmar que pruebas, publicación y job de GKE terminaron correctamente.
4. El workflow aplica Kustomize, espera los rollouts, verifica el certificado HTTPS, la salud de los backends del Ingress y smoke tests en /, /healthz y /api/health.

El workflow de CI/CD usa Workload Identity Federation. No crear ni usar una llave JSON de Service Account para GitHub Actions.

## 7. Validación de solo lectura

Con credenciales autorizadas para el clúster:

~~~powershell
gcloud container clusters get-credentials yousac-prod --region us-central1 --project yousac-202300396-2026
kubectl get nodes
kubectl get deployments,statefulsets,daemonsets,pods,services,cronjobs,ingress -n yousac-prod
kubectl get jobs -n yousac-prod
kubectl get managedcertificate -n yousac-prod
kubectl get events -n yousac-prod --sort-by=.lastTimestamp
~~~

Comprobar que los Pods estén Ready, los rollouts completos, el Ingress tenga backends saludables y el ManagedCertificate esté Active. Validar los endpoints públicos y una operación funcional de cada integración (catálogo federado y Academix) sin imprimir tokens ni llaves. El resultado de estas consultas debe registrarse como evidencia de ejecución, con fecha y ambiente.

## 8. Diagnóstico y recuperación

| Síntoma | Comprobación segura | Acción inicial |
|---|---|---|
| Pod Pending o CrashLoopBackOff | Definir el nombre real del Pod y ejecutar kubectl describe pod $pod -n yousac-prod y kubectl logs $pod -n yousac-prod --previous | Revisar eventos, configuración y dependencias; no borrar Pods antes de conservar logs. |
| Error de base de datos | Revisar estado del Cloud SQL Auth Proxy, identidad Workload Identity y nombre de conexión sin imprimir DATABASE_URL | Confirmar permisos y referencia de conexión; no abrir rangos públicos como solución temporal. |
| Redis no responde | Revisar el modo/host configurado en el preflight y conectividad hacia yousac-vm-nube o Memorystore | Confirmar ruta/firewall; no asumir que Redis vive en vpc-yousac. |
| Ingress/certificado no listo | kubectl describe ingress y kubectl describe managedcertificate -n yousac-prod | Verificar DNS, IP reservada y estado del certificado. |
| No llegan logs a Kibana | Revisar pods Fluent Bit, conectividad al Logstash de vm-observability-yousac y logs de los agentes | Confirmar peering/firewall y listener 5044; conservar los logs antes de reiniciar agentes. |
| Rollout falla tras publicar | Revisar el job de GitHub Actions, eventos y logs de los Pods | Detener nuevas publicaciones y aplicar el procedimiento de rollback aprobado. |

### Rollback de aplicación

Primero revisar el historial y la versión que se va a recuperar:

~~~powershell
$deployment = "NOMBRE_REAL_DEL_DEPLOYMENT"
kubectl rollout history "deployment/$deployment" -n yousac-prod
kubectl rollout status "deployment/$deployment" -n yousac-prod
~~~

El responsable puede autorizar kubectl rollout undo "deployment/$deployment" -n yousac-prod para revertir una implementación de Kubernetes, o volver a desplegar el commit/tag conocido mediante el workflow. El pipeline no debe describirse como rollback automático: ante falla detiene el flujo y produce diagnóstico. Verificar después salud, versión y smoke tests.

### Rollback de infraestructura

No hay un rollback automático general de Terraform/Ansible. Restaurar el cambio de código/variables conocido, generar un plan nuevo y revisarlo antes de aplicar. No borrar el estado, no ejecutar terraform destroy y no eliminar discos, buckets, recursos adoptados ni datos de Cloud SQL para “volver atrás”. Cualquier cambio destructivo requiere plan de recuperación y autorización explícita.

## 9. Referencias

- [Documento técnico consolidado YoUSAC Fase 3](YoUSAC_3.md)
- [CI/CD](CI_CD.md)
- [Despliegue GKE](../k8s/README.md)
- [Terraform](../infra/terraform/)
- [Ansible](../infra/ansible/)
- [Fuentes editables de las vistas 4+1](Practica7/Vistas4+1/XML/)
- [Fuentes editables de alto nivel, pipeline y flujos](../docs/fase3/diagramas/)
