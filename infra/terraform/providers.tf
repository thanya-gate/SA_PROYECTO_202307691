###############################################################################
# providers.tf - Configuracion del proveedor de Google Cloud.
#
# Las credenciales NO van aqui: llegan por GOOGLE_CREDENTIALS o por las
# credenciales de aplicacion predeterminadas (ver versions.tf).
###############################################################################

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}