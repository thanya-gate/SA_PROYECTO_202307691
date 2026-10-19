###############################################################################
# outputs.tf - Valores que Terraform expone al terminar el apply.
# sensitive = true NO protege el valor, porque Terraform lo escribe plano
# en terraform.tfstate. Por eso aca solo se exponen IPs y nombres publicables.
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

output "vpc_self_link" {
  description = "URL completa de la VPC."
  value       = google_compute_network.vpc.self_link
}

# Subredes.
output "development_subnet_name" {
  description = "Nombre de la subred de desarrollo."
  value       = google_compute_subnetwork.development.name
}

output "development_subnet_cidr" {
  description = "Rango CIDR de la subred de desarrollo."
  value       = google_compute_subnetwork.development.ip_cidr_range
}

output "production_subnet_name" {
  description = "Nombre de la subred de produccion."
  value       = google_compute_subnetwork.production.name
}

output "production_subnet_cidr" {
  description = "Rango CIDR de la subred de produccion."
  value       = google_compute_subnetwork.production.ip_cidr_range
}

# IPs publicas: las que pide la hoja de calificacion.
#   $ terraform output development_public_ip
#   $ terraform output production_public_ip
output "development_public_ip" {
  description = "IP publica de vm-development."
  value       = google_compute_instance.development.network_interface[0].access_config[0].nat_ip
}

output "production_public_ip" {
  description = "IP publica de vm-production-k3s."
  value       = google_compute_instance.production.network_interface[0].access_config[0].nat_ip
}

# IPs internas: estaticas, las usa el inventario de Ansible entre VMs.
output "development_internal_ip" {
  description = "IP privada estatica de vm-development."
  value       = google_compute_instance.development.network_interface[0].network_ip
}

output "production_internal_ip" {
  description = "IP privada estatica de vm-production-k3s."
  value       = google_compute_instance.production.network_interface[0].network_ip
}

# Identificadores de las VMs.
output "development_instance_id" {
  description = "ID de la instancia de desarrollo."
  value       = google_compute_instance.development.instance_id
}

output "production_instance_id" {
  description = "ID de la instancia de produccion."
  value       = google_compute_instance.production.instance_id
}

# Comandos listos para copiar.
# Se usa la clave PRIVADA; con la .pub el comando falla con
# "Permission denied (publickey)".
output "ssh_command_development" {
  description = "Comando SSH completo para entrar a vm-development."
  value       = "ssh -i ${pathexpand(var.ssh_private_key_path)} ${var.ssh_username}@${google_compute_instance.development.network_interface[0].access_config[0].nat_ip}"
}

output "ssh_command_production" {
  description = "Comando SSH completo para entrar a vm-production-k3s."
  value       = "ssh -i ${pathexpand(var.ssh_private_key_path)} ${var.ssh_username}@${google_compute_instance.production.network_interface[0].access_config[0].nat_ip}"
}

output "ssh_command_production_via_iap" {
  description = "Comando SSH a vm-production-k3s por Identity-Aware Proxy."
  value       = "gcloud compute ssh ${var.production_instance_name} --zone=${var.zone} --project=${var.project_id} --tunnel-through-iap"
}

# Puertos abiertos: se genera desde las mismas variables que usa firewall.tf para
# que la documentacion tecnica y el codigo no puedan contradecirse.
output "firewall_rules" {
  description = "Nombres de las reglas de firewall creadas."
  value = [
    google_compute_firewall.allow_ssh.name,
    google_compute_firewall.allow_http.name,
    google_compute_firewall.allow_https.name,
    google_compute_firewall.allow_k3s_api.name,
    google_compute_firewall.allow_k3s_telemetry.name,
    google_compute_firewall.allow_internal.name,
    google_compute_firewall.allow_health_checks.name,
    google_compute_firewall.allow_egress.name,
  ]
}

output "open_ports_summary" {
  description = "Resumen legible de los puertos abiertos, para el informe tecnico."
  value       = <<-EOT
    Ingress sobre la VPC ${var.vpc_cidr}
      22/tcp        ${var.allowed_ssh_cidr}            -> development, production
      80/tcp        ${var.allowed_http_cidr}            -> development, production
      443/tcp       ${var.allowed_https_cidr}           -> development, production
      6443/tcp      ${var.allowed_k3s_api_cidr}         -> solo ${var.production_instance_name}
      2379-2380/tcp ${var.vpc_cidr}  etcd             -> solo ${var.production_instance_name}
      4443/tcp      ${var.vpc_cidr}  telemetry webhook-> solo ${var.production_instance_name}
      10250/tcp+udp ${var.vpc_cidr}  kubelet API       -> solo ${var.production_instance_name}
      8472/udp      ${var.vpc_cidr}  Flannel VXLAN     -> solo ${var.production_instance_name}
      30000-32767   ${var.vpc_cidr}  NodePort tcp+udp  -> solo ${var.production_instance_name}
      todos         ${var.vpc_cidr}  trafico interno  -> development, production
      tcp           130.211.0.0/22, 35.191.0.0/16     -> sondas de Google
  EOT
}

# Datos para el punto 2: un solo output con las dos VMs para generar el
# inventario con `terraform output -json ansible_hosts`.
output "ansible_hosts" {
  description = "Mapa de hosts con las IPs resueltas, para el inventario de Ansible."
  value = {
    development = {
      hostname  = google_compute_instance.development.name
      ip        = google_compute_instance.development.network_interface[0].network_ip
      public_ip = google_compute_instance.development.network_interface[0].access_config[0].nat_ip
      role      = "development"
      os        = "ubuntu-2404-lts"
    }
    production = {
      hostname  = google_compute_instance.production.name
      ip        = google_compute_instance.production.network_interface[0].network_ip
      public_ip = google_compute_instance.production.network_interface[0].access_config[0].nat_ip
      role      = "production"
      os        = "ubuntu-2404-lts"
    }
  }
}