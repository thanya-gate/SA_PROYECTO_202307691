###############################################################################
# storage.tf - Buckets de GCS y politicas de acceso.
#
# Flujo de los videos/materiales:
#   subida   -> API Gateway (Workload Identity del KSA yousac-gateway)
#   entrega  -> el propio Gateway sirve el stream desde GCS.
# Por eso los buckets NO son publicos: acceso uniforme a nivel de bucket y
# solo la cuenta de servicio del Gateway escribe.
###############################################################################

# Import del bucket productivo de videos.
import {
  to = google_storage_bucket.videos
  id = "yousac-videos"
}

resource "google_storage_bucket" "videos" {
  project                     = var.project_id
  name                        = var.bucket_videos
  location                    = "US-CENTRAL1"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"
  force_destroy               = false

  versioning {
    enabled = false
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  labels = var.labels
}

# Import del bucket productivo de material de laboratorio.
import {
  to = google_storage_bucket.material
  id = "yousac-material"
}

resource "google_storage_bucket" "material" {
  project                     = var.project_id
  name                        = var.bucket_material
  location                    = "US-CENTRAL1"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"
  force_destroy               = false

  versioning {
    enabled = false
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  labels = var.labels
}

# La cuenta de servicio del Gateway (Workload Identity) administra los objetos.
resource "google_storage_bucket_iam_member" "gateway_videos" {
  bucket = google_storage_bucket.videos.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.gateway_storage_sa}"
}

resource "google_storage_bucket_iam_member" "gateway_material" {
  bucket = google_storage_bucket.material.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.gateway_storage_sa}"
}

# Los sidecars de Cloud SQL Auth Proxy leen/escriben respaldos en el bucket de
# videos (mismo bucket que usa el proyecto para artefactos de base de datos).
resource "google_storage_bucket_iam_member" "cloudsql_proxy_videos" {
  bucket = google_storage_bucket.videos.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.cloudsql_proxy_sa}"
}
