###############################################################################
# versions.tf - Versiones de Terraform, backend remoto y proveedores.
#
# No se declara `credentials` en el bloque provider: Terraform escribiria la
# clave en el .tfstate y ese archivo no se puede desmarcar como sensible. La
# autenticacion llega del exterior (Application Default Credentials de gcloud).
#
# El estado remoto vive en el bucket GCS yousac-tfstate: asi el estado no se
# pierde si la maquina que ejecuta Terraform falla, y el equipo comparte una
# unica fuente de verdad.
###############################################################################

terraform {
  # La 1.5.0 introdujo los bloques `moved` e `import`; los bloques `import`
  # declarativos (los que se usan aqui) llegaron en la 1.5 y maduraron en 1.6.
  required_version = ">= 1.6.0"

  backend "gcs" {
    bucket = "yousac-tfstate"
    prefix = "terraform/state"
  }

  required_providers {
    google = {
      source = "hashicorp/google"
      # ~> 6.x = cualquier 6.x, pero nunca 7.x.
      version = "~> 6.0"
    }
    # Escribe el inventario de Ansible con las IPs resueltas (ansible.tf).
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}
