###############################################################################
# versions.tf - Versiones de Terraform y de los proveedores requeridos.
#
# No se declara `credentials` en el bloque provider: Terraform escribiria la
# clave en el .tfstate y ese archivo no se puede desmarcar como sensible. La
# autenticacion llega del exterior:
#   $env:GOOGLE_CREDENTIALS = "$env:USERPROFILE\.gcp\terraform-academix-sa.json"
###############################################################################

terraform {
  # La 1.5.0 introdujo los bloques `moved` e `import`.
  required_version = ">= 1.5.0"

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
  }
}