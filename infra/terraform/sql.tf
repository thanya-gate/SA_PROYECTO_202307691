###############################################################################
# sql.tf - Base de datos relacional gestionada (Cloud SQL PostgreSQL).
#
# El enunciado exige que las bases de datos operacionales vivan en servicios
# gestionados completamente fuera del cluter de Kubernetes. La instancia
# yousac-p6-db ya existe y hospeda las 6 bases logicas (una por microservicio).
# Terraform la adopta con un bloque import.
###############################################################################

import {
  to = google_sql_database_instance.postgres
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}"
}

resource "google_sql_database_instance" "postgres" {
  project             = var.project_id
  name                = var.sql_instance_name
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    activation_policy = "ALWAYS"

    disk_type       = "PD_SSD"
    disk_size       = 10
    disk_autoresize = true

    # IP publica habilitada (los sidecars Cloud SQL Auth Proxy conectan por
    # el conector seguro). No hay redes autorizadas: el acceso pasa por el
    # proxy y la identidad de carga de trabajo.
    ip_configuration {
      ipv4_enabled = true
    }

    backup_configuration {
      enabled                        = false
      point_in_time_recovery_enabled = false
    }

    user_labels = var.labels
  }

  lifecycle {
    # El schema (las 6 bases y sus objetos) se despliega con los scripts SQL
    # del repositorio, no con Terraform. Se ignoran los defaults que Cloud SQL
    # completa por su cuenta para evitar deriva espuria.
    ignore_changes = [
      settings[0].disk_autoresize_limit,
      settings[0].ip_configuration[0].ssl_mode,
      settings[0].enable_dataplex_integration,
    ]
  }
}

# Usuario de la aplicacion. La contrasena NO se declara aqui: llega por la
# variable de entorno TF_VAR_postgres_password y jamas se escribe en el repo.
resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac"
  password = var.postgres_password

  lifecycle {
    # Si la contrasena se rota fuera de Terraform, no forzamos su reintroduccion.
    ignore_changes = [password]
  }
}

# Las 6 bases logicas, una por microservicio.
import {
  to = google_sql_database.auth
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}/databases/yousac_auth"
}

resource "google_sql_database" "auth" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac_auth"
}

import {
  to = google_sql_database.catalog
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}/databases/yousac_catalog"
}

resource "google_sql_database" "catalog" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac_catalog"
}

import {
  to = google_sql_database.reproduccion
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}/databases/yousac_reproduccion"
}

resource "google_sql_database" "reproduccion" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac_reproduccion"
}

import {
  to = google_sql_database.analitica
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}/databases/yousac_analitica"
}

resource "google_sql_database" "analitica" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac_analitica"
}

import {
  to = google_sql_database.inscripcion
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}/databases/yousac_inscripcion"
}

resource "google_sql_database" "inscripcion" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac_inscripcion"
}

import {
  to = google_sql_database.notificaciones
  id = "projects/${var.project_id}/instances/${var.sql_instance_name}/databases/yousac_notificaciones"
}

resource "google_sql_database" "notificaciones" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "yousac_notificaciones"
}

# La cuenta de servicio de los sidecars necesita permisos de cliente Cloud SQL.
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.cloudsql_proxy_sa}"
}
