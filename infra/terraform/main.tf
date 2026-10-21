###############################################################################
# main.tf - VPC, subredes, enrutamiento y instancias de computo de YoUSAC.
###############################################################################

locals {
  # trimspace elimina el salto de linea final, que GCP rechaza en los metadatos.
  # Una linea "usuario:clave" por integrante: GCP acepta varias separadas por \n.
  ssh_keys_metadata = join("\n", [
    for path in var.ssh_public_key_paths :
    "${var.ssh_username}:${trimspace(file(pathexpand(path)))}"
  ])

  # Las reglas de firewall apuntan a target_tags, nunca a una IP.
  common_tags        = var.network_tags
  development_tags   = concat(var.network_tags, [var.development_tag])
  observability_tags = concat(var.network_tags, [var.observability_tag])
}

# Se declara la red virtual privada de YoUSAC.
# auto_create_subnetworks = false obliga a definir las tres capas a mano.
resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = var.network_name
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  description             = "VPC de YoUSAC Fase 3. Aisla la infraestructura del proyecto del resto de la red de Google. ${var.vpc_cidr}"
}

# --- Capa perimetral ---------------------------------------------------------
resource "google_compute_subnetwork" "perimetral" {
  project                  = var.project_id
  name                     = var.subnet_perimetral
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_perimetral_cidr
  private_ip_google_access = true
  description              = "Capa perimetral de YoUSAC (ingress / borde). ${var.subnet_perimetral_cidr}"
}

# --- Capa de aplicacion ------------------------------------------------------
resource "google_compute_subnetwork" "aplicacion" {
  project                  = var.project_id
  name                     = var.subnet_aplicacion
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_aplicacion_cidr
  private_ip_google_access = true
  description              = "Capa de aplicacion de YoUSAC: VMs de servicio y desarrollo. ${var.subnet_aplicacion_cidr}"
}

# --- Capa de datos -----------------------------------------------------------
resource "google_compute_subnetwork" "datos" {
  project                  = var.project_id
  name                     = var.subnet_datos
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_datos_cidr
  private_ip_google_access = true
  description              = "Capa de datos de YoUSAC: ELK y bases de datos externas al cluster. ${var.subnet_datos_cidr}"
}

# --- Salida a internet sin IP publica ---------------------------------------
# Las VMs no llevan IP publica: salen por Cloud Router + NAT. Asi apt, Docker
# y los recolectores funcionan sin exponer puertos a internet.
resource "google_compute_router" "yousac" {
  project = var.project_id
  name    = "router-yousac"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "yousac" {
  project                            = var.project_id
  name                               = "nat-yousac"
  router                             = google_compute_router.yousac.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# --- Integracion con la red del cluster GKE ----------------------------------
# El cluster GKE Autopilot de produccion vive en la red `default` (adoptado por
# Terraform en gke.tf). El peering permite que los pods (Fluent Bit, proxy de
# Kibana, Prometheus) alcancen las VMs de vpc-yousac por IP privada, y que
# Prometheus raspee node-exporter. Se declara en ambos sentidos: GCP exige un
# objeto de peering por red para que la conexion quede ACTIVE.
resource "google_compute_network_peering" "yousac_to_default" {
  name         = "yousac-to-default"
  network      = google_compute_network.vpc.id
  peer_network = "projects/${var.project_id}/global/networks/${var.gke_network_name}"
}

resource "google_compute_network_peering" "default_to_yousac" {
  name         = "default-to-yousac"
  network      = "projects/${var.project_id}/global/networks/${var.gke_network_name}"
  peer_network = google_compute_network.vpc.id

  depends_on = [google_compute_network_peering.yousac_to_default]
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
  description = "VM de desarrollo de YoUSAC. Hospeda Docker Compose con el entorno de pruebas."

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

  # Sin access_config = sin IP publica. Se llega por Identity-Aware Proxy
  # (ver firewall.tf y el inventario que genera ansible.tf).
  network_interface {
    subnetwork = google_compute_subnetwork.aplicacion.id
    network_ip = var.development_internal_ip
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

  depends_on = [
    google_compute_subnetwork.aplicacion,
    google_compute_router_nat.yousac,
  ]
}

# VM de observabilidad: aloja Elasticsearch, Logstash y Kibana (stack ELK).
resource "google_compute_instance" "observability" {
  project      = var.project_id
  name         = var.observability_instance_name
  zone         = var.zone
  machine_type = var.observability_machine_type

  tags        = local.observability_tags
  labels      = var.labels
  description = "VM de observabilidad de YoUSAC. Elasticsearch + Logstash + Kibana en la capa de datos."

  allow_stopping_for_update = true
  deletion_protection       = false

  boot_disk {
    auto_delete = true

    initialize_params {
      image  = var.boot_disk_image
      size   = var.observability_disk_size_gb
      type   = "pd-balanced"
      labels = var.labels
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.datos.id
    network_ip = var.observability_internal_ip
  }

  metadata = {
    ssh-keys = local.ssh_keys_metadata
  }

  shielded_instance_config {
    enable_secure_boot          = false
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  depends_on = [
    google_compute_subnetwork.datos,
    google_compute_router_nat.yousac,
  ]
}
