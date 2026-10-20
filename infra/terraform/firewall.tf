###############################################################################
# firewall.tf - Reglas de firewall de la VPC de YoUSAC.
#
# En Google Cloud la regla se adjunta a la red, no a la VM. Cada una declara
# puertos y protocolos (allow), origen (source_ranges) y a que se aplica
# (target_tags). Google evalua por prioridad ASCENDENTE: 1000 antes que 1010.
#
# Las VMs no llevan IP publica: el acceso administrativo es por Identity-Aware
# Proxy. El ingress publico de produccion lo publica el Ingress del cluter GKE.
###############################################################################

# SSH (22). Origen restringido a Identity-Aware Proxy por defecto.
resource "google_compute_firewall" "allow_ssh" {
  project     = var.project_id
  name        = "fw-yousac-allow-ssh"
  network     = google_compute_network.vpc.name
  description = "SSH (22) para Ansible y administracion via IAP. Origen: ${var.allowed_ssh_cidr}"

  direction = "INGRESS"
  priority  = 1000

  source_ranges = [var.allowed_ssh_cidr]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  target_tags = var.network_tags
}

# HTTP (80). Lo consume la VM de observabilidad para el redirect a HTTPS de
# Kibana (Caddy). El trafico publico de la aplicacion llega por el Ingress.
resource "google_compute_firewall" "allow_http" {
  project     = var.project_id
  name        = "fw-yousac-allow-http"
  network     = google_compute_network.vpc.name
  description = "HTTP (80) para redireccion a HTTPS de Kibana y comprobaciones de salud."

  direction = "INGRESS"
  priority  = 1010

  source_ranges = ["0.0.0.0/0"]

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  target_tags = var.network_tags
}

# HTTPS (443). Lo consume la VM de observabilidad (Kibana con TLS de Caddy).
resource "google_compute_firewall" "allow_https" {
  project     = var.project_id
  name        = "fw-yousac-allow-https"
  network     = google_compute_network.vpc.name
  description = "HTTPS (443) para Kibana con TLS terminado en la VM de observabilidad."

  direction = "INGRESS"
  priority  = 1020

  source_ranges = ["0.0.0.0/0"]

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  target_tags = var.network_tags
}

# Elasticsearch (9200) y Logstash (5044/5000): SOLO desde el cluter GKE.
# Fluent Bit reenvia los logs de los pods a Logstash y Prometheus puede raspar.
resource "google_compute_firewall" "allow_observability_from_gke" {
  project     = var.project_id
  name        = "fw-yousac-allow-observability"
  network     = google_compute_network.vpc.name
  description = "Elasticsearch/Logstash solo aceptan trafico desde el cluter GKE (${join(", ", var.gke_source_ranges)})."

  direction = "INGRESS"
  priority  = 1030

  source_ranges = var.gke_source_ranges

  allow {
    protocol = "tcp"
    ports    = ["9200", "5044", "5000", "9100", "9115"]
  }

  target_tags = [var.observability_tag]
}

# Kibana (5601). El proxy /health del API Gateway consulta Kibana desde los
# pods del cluter GKE.
resource "google_compute_firewall" "allow_kibana_from_gke" {
  project     = var.project_id
  name        = "fw-yousac-allow-kibana"
  network     = google_compute_network.vpc.name
  description = "Kibana (5601) solo acepta trafico desde el cluter GKE."

  direction = "INGRESS"
  priority  = 1031

  source_ranges = var.gke_source_ranges

  allow {
    protocol = "tcp"
    ports    = ["5601"]
  }

  target_tags = [var.observability_tag]
}

# Kibana (5601) desde los rangos del balanceador de Google. El Ingress de GKE
# expone Kibana (host kibana.yousac-thany.duckdns.org) apuntando por Endpoints
# a la VM de observabilidad; las sondas de salud y el trafico del proxy del
# balanceador global no pertenecen al rango de pods, por eso se declara aparte.
resource "google_compute_firewall" "allow_kibana_from_lb" {
  project     = var.project_id
  name        = "fw-yousac-allow-kibana-lb"
  network     = google_compute_network.vpc.name
  description = "Kibana (5601) accesible por el Ingress de GKE desde los rangos del balanceador de Google (sondas de salud y proxy)."

  direction = "INGRESS"
  priority  = 1032

  # 130.211.0.0/22 y 35.191.0.0/16 son los rangos oficiales de las sondas de
  # salud y el proxy del balanceador de aplicacion de Google Cloud.
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]

  allow {
    protocol = "tcp"
    ports    = ["5601"]
  }

  target_tags = [var.observability_tag]
}

# Trafico interno de la VPC: aplicacion <-> datos <-> perimetral.
resource "google_compute_firewall" "allow_internal" {
  project     = var.project_id
  name        = "fw-yousac-allow-internal-vpc"
  network     = google_compute_network.vpc.name
  description = "Trafico entre las tres subredes de vpc-yousac (aplicacion, datos y perimetral)."

  direction = "INGRESS"
  priority  = 1050

  source_ranges = [var.vpc_cidr]

  allow {
    protocol = "all"
  }

  target_tags = var.network_tags
}

# Egreso. Se declara la regla para que quede explicito que no se restringe.
resource "google_compute_firewall" "allow_egress" {
  project     = var.project_id
  name        = "fw-yousac-allow-egress"
  network     = google_compute_network.vpc.name
  description = "Trafico de salida (apt, Docker registry, downloads de ELK). Se documenta la limitacion en el informe tecnico."

  direction = "EGRESS"
  priority  = 1000

  # En una regla EGRESS el rango relevante es el destino, no el origen.
  destination_ranges = ["0.0.0.0/0"]

  allow {
    protocol = "all"
  }

  target_tags = var.network_tags
}
