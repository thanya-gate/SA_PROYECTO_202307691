###############################################################################
# firewall.tf - Reglas de firewall de la VPC.
#
# En Google Cloud la regla se adjunta a la red, no a la VM. Cada una declara
# puertos y protocolos (allow), origen (source_ranges) y a que se aplica
# (target_tags). Google evalua por prioridad ASCENDENTE: 1000 antes que 1010.
###############################################################################

# SSH (22). Aplica a las dos VMs porque ambas llevan la etiqueta comun.
resource "google_compute_firewall" "allow_ssh" {
  project     = var.project_id
  name        = "fw-allow-ssh"
  network     = google_compute_network.vpc.name
  description = "SSH (22) para administracion y Ansible. Origen: ${var.allowed_ssh_cidr}"

  direction = "INGRESS"
  priority  = 1000

  source_ranges = [var.allowed_ssh_cidr]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  target_tags = var.network_tags
}

# HTTP (80) - trafico web publico de la aplicacion.
resource "google_compute_firewall" "allow_http" {
  project     = var.project_id
  name        = "fw-allow-http"
  network     = google_compute_network.vpc.name
  description = "HTTP (80) para el trafico web publico de Academix Pass."

  direction = "INGRESS"
  priority  = 1010

  source_ranges = [var.allowed_http_cidr]

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  target_tags = var.network_tags
}

# HTTPS (443) - trafico TLS de la aplicacion.
resource "google_compute_firewall" "allow_https" {
  project     = var.project_id
  name        = "fw-allow-https"
  network     = google_compute_network.vpc.name
  description = "HTTPS (443) para el trafico TLS de Academix Pass."

  direction = "INGRESS"
  priority  = 1020

  source_ranges = [var.allowed_https_cidr]

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  target_tags = var.network_tags
}

# K3s API (6443). Solo la VM de produccion.
resource "google_compute_firewall" "allow_k3s_api" {
  project     = var.project_id
  name        = "fw-allow-k3s-api"
  network     = google_compute_network.vpc.name
  description = "K3s API server (6443). Exclusivo de vm-production-k3s."

  direction = "INGRESS"
  priority  = 1030

  source_ranges = [var.allowed_k3s_api_cidr]

  allow {
    protocol = "tcp"
    ports    = ["6443"]
  }

  target_tags = [var.environment_tag]
}

# Telemetria e interna del cluster K3s: etcd, Flannel, Kubelet, webhook y
# NodePort. Solo la VM de produccion y solo trafico de la propia VPC.
resource "google_compute_firewall" "allow_k3s_telemetry" {
  project     = var.project_id
  name        = "fw-allow-k3s-telemetry"
  network     = google_compute_network.vpc.name
  description = "Puertos de telemetria e internos del cluster K3s. Exclusivo de vm-production-k3s."

  direction = "INGRESS"
  priority  = 1040

  source_ranges = [var.vpc_cidr]

  allow {
    protocol = "tcp"
    ports    = ["2379-2380", "4443", "10250", "30000-32767"]
  }

  allow {
    protocol = "udp"
    ports    = ["8472", "10250", "30000-32767"]
  }

  target_tags = [var.environment_tag]
}

# Trafico interno de la VPC: development <-> production.
resource "google_compute_firewall" "allow_internal" {
  project     = var.project_id
  name        = "fw-allow-internal-vpc"
  network     = google_compute_network.vpc.name
  description = "Trafico entre las VMs de la VPC (development <-> production, gossip de Flannel, etc.)."

  direction = "INGRESS"
  priority  = 1050

  source_ranges = [var.vpc_cidr]

  allow {
    protocol = "all"
  }

  target_tags = var.network_tags
}

# Sondas de salud de Google: rangos fijos de los balanceadores de Google Cloud.
resource "google_compute_firewall" "allow_health_checks" {
  project     = var.project_id
  name        = "fw-allow-health-checks"
  network     = google_compute_network.vpc.name
  description = "Sondas de salud del balanceador de Google. Rangos oficiales de Google Cloud."

  direction = "INGRESS"
  priority  = 1060

  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]

  allow {
    protocol = "tcp"
  }

  target_tags = var.network_tags
}

# Egreso. Se declara la regla para que quede explicito que no se restringe.
resource "google_compute_firewall" "allow_egress" {
  project     = var.project_id
  name        = "fw-allow-egress"
  network     = google_compute_network.vpc.name
  description = "Trafico de salida (apt, Docker registry, get.k3s.io). Se documenta la limitacion en el informe tecnico."

  direction = "EGRESS"
  priority  = 1000

  # En una regla EGRESS el rango relevante es el destino, no el origen.
  destination_ranges = ["0.0.0.0/0"]

  allow {
    protocol = "all"
  }

  target_tags = var.network_tags
}