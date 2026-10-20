###############################################################################
# gke.tf - Cluter administrado de Kubernetes (GKE Autopilot).
#
# El cluter yousac-prod ya existia, creado a mano en una iteracion anterior.
# Se adopta con un bloque import para que Terraform sea, desde ahora, la unica
# fuente de verdad (el enunciado prohibe aprovisionar por clics en la consola).
#
# NOTA DE DISENO: el cluter vive en la red `default` (VPC-native) y NO se
# migra a vpc-yousac. Migrar un cluter Autopilot en produccion implicaria
# recrearlo (downtime y perdida de la IP global del Ingress). La separacion de
# capas se cumple en la VPC de las VMs (perimetral/aplicacion/datos) y el
# cluter se conecta por peering de red (ver main.tf).
###############################################################################

import {
  to = google_container_cluster.primary
  id = "projects/${var.project_id}/locations/${var.region}/clusters/${var.gke_cluster_name}"
}

resource "google_container_cluster" "primary" {
  project  = var.project_id
  name     = var.gke_cluster_name
  location = var.region

  # Autopilot: Google administra los nodos; el grupo solo publica manifiestos.
  enable_autopilot = true

  # El cluter productivo mantiene la proteccion contra borrado accidental.
  deletion_protection = true

  network    = var.gke_network_name
  subnetwork = var.gke_subnetwork_name

  # Identidad de carga de trabajo: el KSA yousac-runtime asume el GSA de
  # Cloud SQL Auth Proxy, y yousac-gateway asume el de Storage.
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  release_channel {
    channel = "REGULAR"
  }

  # Observabilidad gestionada: prometheus gestionado alimenta los tableros de
  # negocio y los componentes del sistema cubren nodos/pods.
  monitoring_config {
    managed_prometheus {
      enabled = true
    }

    enable_components = [
      "SYSTEM_COMPONENTS",
      "STORAGE",
      "HPA",
      "POD",
      "DAEMONSET",
      "DEPLOYMENT",
      "STATEFULSET",
      "CADVISOR",
      "KUBELET",
      "DCGM",
      "JOBSET",
    ]
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  # Los endpoints publico y privado del plano de control ya existen; el
  # endpoint publico es el que usa el pipeline de CI/CD con sus credenciales.
  private_cluster_config {
    enable_private_nodes    = false
    enable_private_endpoint = false
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  lifecycle {
    # Autopilot actualiza el plano de control por su cuenta; no queremos que
    # Terraform intente revertir esas actualizaciones del proveedor.
    ignore_changes = [
      master_auth,
      node_pool,
      node_config,
      min_master_version,
      monitoring_config[0].enable_components,
      logging_config[0].enable_components,
      # Kubernetes Autopilot habilita/deshabilita addons por su cuenta.
      addons_config,
    ]
  }
}

# IP global estatica del Ingress. Es la que resuelve el dominio
# yousac-thany.duckdns.org y la que el Ingress declara como anotacion.
import {
  to = google_compute_global_address.ingress
  id = "projects/${var.project_id}/global/addresses/${var.static_ip_name}"
}

resource "google_compute_global_address" "ingress" {
  project      = var.project_id
  name         = var.static_ip_name
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
}
