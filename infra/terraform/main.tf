###############################################################################
# main.tf - VPC, subredes e instancias de computo.
###############################################################################

locals {
  # trimspace elimina el salto de linea final, que GCP rechaza en los metadatos.
  # Una linea "usuario:clave" por integrante: GCP acepta varias separadas por \n.
  ssh_keys_metadata = join("\n", [
    for path in var.ssh_public_key_paths :
    "${var.ssh_username}:${trimspace(file(pathexpand(path)))}"
  ])

  # Las reglas de firewall apuntan a target_tags, nunca a una IP.
  common_tags      = var.network_tags
  development_tags = concat(var.network_tags, ["development"])
  production_tags  = concat(var.network_tags, [var.environment_tag])
}

# Se declara la red virtual privada.
# auto_create_subnetworks = false evita las subredes automaticas de cada region.
resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = var.network_name
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  description             = "VPC de Academix Pass. Aisla la infraestructura del proyecto del resto de la red de Google. ${var.vpc_cidr}"
}

# Subred de desarrollo. private_ip_google_access habilita la salida a internet.
resource "google_compute_subnetwork" "development" {
  project                  = var.project_id
  name                     = var.subnet_development
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_development_cidr
  private_ip_google_access = true
  description              = "Subred dedicada a vm-development (Docker Compose). Entorno no productivo."
}

# Subred de produccion.
resource "google_compute_subnetwork" "production" {
  project                  = var.project_id
  name                     = var.subnet_production
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_production_cidr
  private_ip_google_access = true
  description              = "Subred dedicada a vm-production-k3s (control-plane de K3s). Entorno productivo."
}

# VM de desarrollo: corre Docker Compose.
# deletion_protection = false y auto_delete son los que permiten el
# terraform destroy de la prueba de reconstruccion.
resource "google_compute_instance" "development" {
  project      = var.project_id
  name         = var.development_instance_name
  zone         = var.zone
  machine_type = var.development_machine_type

  tags        = local.development_tags
  labels      = var.labels
  description = "VM de desarrollo de Academix Pass. Hospeda Docker Compose con el frontend y los servicios de negocio."

  allow_stopping_for_update = true
  deletion_protection       = false

  boot_disk {
    auto_delete = true

    initialize_params {
      image  = var.boot_disk_image
      size   = var.boot_disk_size_gb
      type   = "pd-balanced"
      labels = var.labels
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.development.id

    # IP interna estatica (network_ip es el nombre del atributo en el proveedor).
    network_ip = var.development_internal_ip

    # access_config vacio = IP publica efimera, liberada al destruir.
    access_config {}
  }

  metadata = {
    # Formato GCP "usuario:clave". Cloud-init la agrega al authorized_keys.
    ssh-keys = local.ssh_keys_metadata
  }

  shielded_instance_config {
    enable_secure_boot          = false
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  depends_on = [google_compute_subnetwork.development]
}

# VM de produccion: aloja el control-plane del cluster K3s.
resource "google_compute_instance" "production" {
  project      = var.project_id
  name         = var.production_instance_name
  zone         = var.zone
  machine_type = var.production_machine_type

  tags        = local.production_tags
  labels      = var.labels
  description = "VM de produccion de Academix Pass. Aloja el control-plane del cluster K3s."

  allow_stopping_for_update = true
  deletion_protection       = false

  boot_disk {
    auto_delete = true

    initialize_params {
      image  = var.boot_disk_image
      size   = var.boot_disk_size_gb
      type   = "pd-balanced"
      labels = var.labels
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.production.id
    network_ip = var.production_internal_ip
    access_config {}
  }

  metadata = {
    ssh-keys = local.ssh_keys_metadata
  }

  shielded_instance_config {
    enable_secure_boot          = false
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  depends_on = [google_compute_subnetwork.production]
}
