###############################################################################
# registry.tf - Container Registry (Artifact Registry).
#
# El pipeline de CI/CD publica las 8 imagenes (frontend, api-gateway y los 6
# microservicios) en este repositorio Docker con etiquetado semantico.
# El repositorio yousac ya existe; Terraform lo adopta con un bloque import.
###############################################################################

import {
  to = google_artifact_registry_repository.images
  id = "projects/${var.project_id}/locations/${var.region}/repositories/${var.artifact_repository_id}"
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository_id
  format        = "DOCKER"
  description   = "Imagenes Docker de los 8 componentes de YoUSAC (Fase 3)."

  labels = var.labels

  lifecycle {
    # El repositorio existente tiene cleanup_policy_dry_run = true. Se adopta
    # tal cual sin forzar la politica desde Terraform.
    ignore_changes = [
      cleanup_policy_dry_run,
      cleanup_policies,
    ]
  }
}
