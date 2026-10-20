###############################################################################
# outputs.tf - Valores que Terraform expone al terminar el apply.
# sensitive = true NO protege el valor, porque Terraform lo escribe plano
# en el estado remoto. Por eso aca solo se exponen IPs y nombres publicables.
###############################################################################

# Identificacion de la red.
output "project_id" {
  description = "ID del proyecto de Google Cloud."
  value       = var.project_id
}

output "vpc_id" {
  description = "ID de la VPC creada."
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  description = "Nombre de la VPC creada."
  value       = google_compute_network.vpc.name
}

output "vpc_cidr" {
  description = "Rango CIDR de la VPC."
  value       = var.vpc_cidr
}

# Subredes por capa.
output "subnet_perimetral_cidr" {
  description = "Rango CIDR de la capa perimetral."
  value       = google_compute_subnetwork.perimetral.ip_cidr_range
}

output "subnet_aplicacion_cidr" {
  description = "Rango CIDR de la capa de aplicacion."
  value       = google_compute_subnetwork.aplicacion.ip_cidr_range
}

output "subnet_datos_cidr" {
  description = "Rango CIDR de la capa de datos."
  value       = google_compute_subnetwork.datos.ip_cidr_range
}

# IPs internas: estaticas, las usa el inventario de Ansible y el firewall.
output "development_internal_ip" {
  description = "IP privada estatica de vm-dev-yousac."
  value       = google_compute_instance.development.network_interface[0].network_ip
}

output "observability_internal_ip" {
  description = "IP privada estatica de vm-observability-yousac (ELK)."
  value       = google_compute_instance.observability.network_interface[0].network_ip
}

# Identificadores de las VMs.
output "development_instance_id" {
  description = "ID de la instancia de desarrollo."
  value       = google_compute_instance.development.instance_id
}

output "observability_instance_id" {
  description = "ID de la instancia de observabilidad."
  value       = google_compute_instance.observability.instance_id
}

# Recursos gestionados adoptados por Terraform.
output "gke_cluster_name" {
  description = "Cluter GKE administrado de produccion."
  value       = google_container_cluster.primary.name
}

output "gke_cluster_endpoint" {
  description = "Endpoint del plano de control del cluter GKE."
  value       = google_container_cluster.primary.endpoint
}

output "sql_instance_name" {
  description = "Instancia Cloud SQL PostgreSQL."
  value       = google_sql_database_instance.postgres.name
}

output "sql_instance_connection_name" {
  description = "Connection name que consumen los sidecars Cloud SQL Auth Proxy."
  value       = google_sql_database_instance.postgres.connection_name
}

output "artifact_registry_repository" {
  description = "Ruta del repositorio Docker de Artifact Registry."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "buckets" {
  description = "Buckets de GCS de la plataforma."
  value = {
    videos   = google_storage_bucket.videos.name
    material = google_storage_bucket.material.name
  }
}

output "ingress_static_ip" {
  description = "IP global estatica que resuelve el dominio de YoUSAC."
  value       = google_compute_global_address.ingress.address
}

# Comandos listos para copiar. El acceso es por Identity-Aware Proxy porque las
# VMs no exponen IP publica.
output "ssh_command_development" {
  description = "Comando SSH a vm-dev-yousac por Identity-Aware Proxy."
  value       = "gcloud compute ssh ${var.development_instance_name} --zone=${var.zone} --project=${var.project_id} --tunnel-through-iap"
}

output "ssh_command_observability" {
  description = "Comando SSH a vm-observability-yousac por Identity-Aware Proxy."
  value       = "gcloud compute ssh ${var.observability_instance_name} --zone=${var.zone} --project=${var.project_id} --tunnel-through-iap"
}

# Puertos abiertos: se genera desde las mismas variables que usa firewall.tf para
# que la documentacion tecnica y el codigo no puedan contradecirse.
output "firewall_rules" {
  description = "Nombres de las reglas de firewall creadas."
  value = [
    google_compute_firewall.allow_ssh.name,
    google_compute_firewall.allow_http.name,
    google_compute_firewall.allow_https.name,
    google_compute_firewall.allow_observability_from_gke.name,
    google_compute_firewall.allow_kibana_from_gke.name,
    google_compute_firewall.allow_internal.name,
    google_compute_firewall.allow_egress.name,
  ]
}

output "open_ports_summary" {
  description = "Resumen legible de los puertos abiertos, para el informe tecnico."
  value       = <<-EOT
    Ingress sobre la VPC ${var.vpc_cidr}
      22/tcp        ${var.allowed_ssh_cidr}   -> development, observability (via IAP)
      80/tcp        0.0.0.0/0                 -> observability (redirect HTTPS de Kibana)
      443/tcp       0.0.0.0/0                 -> observability (Kibana con TLS)
      9200/tcp      ${join(", ", var.gke_source_ranges)} -> observability (Elasticsearch, solo GKE)
      5044/5000/tcp ${join(", ", var.gke_source_ranges)} -> observability (Logstash, solo GKE)
      5601/tcp      ${join(", ", var.gke_source_ranges)} -> observability (Kibana, solo GKE)
      todos         ${var.vpc_cidr}           -> trafico entre capas (perimetral/app/datos)
  EOT
}

# Datos para el inventario de Ansible con `terraform output -json ansible_hosts`.
output "ansible_hosts" {
  description = "Mapa de hosts con las IPs resueltas, para el inventario de Ansible."
  value = {
    development = {
      hostname    = google_compute_instance.development.name
      internal_ip = google_compute_instance.development.network_interface[0].network_ip
      role        = "development"
      os          = "ubuntu-2404-lts"
    }
    observability = {
      hostname    = google_compute_instance.observability.name
      internal_ip = google_compute_instance.observability.network_interface[0].network_ip
      role        = "observability"
      os          = "ubuntu-2404-lts"
    }
  }
}
