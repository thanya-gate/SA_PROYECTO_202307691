###############################################################################
# variables.tf - Entradas del modulo.
#
# Todo lo que un evaluador pueda querer cambiar
# es una variable con valor por defecto.
#
# Topologia de YoUSAC (Fase 3):
#   vpc-yousac 10.20.0.0/16
#     |- subnet-yousac-perimetral 10.20.1.0/24  capa perimetral / ingress
#     |- subnet-yousac-aplicacion 10.20.2.0/24  capa de aplicacion (VMs)
#     |- subnet-yousac-datos      10.20.3.0/24  capa de datos (ELK, BD)
###############################################################################

# Proyecto y ubicacion.
variable "project_id" {
  description = "ID del proyecto de Google Cloud (projectId real de la consola)."
  type        = string
  default     = "yousac-202300396-2026"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id debe ser un projectId valido de GCP: minusculas, guiones, entre 6 y 30 caracteres."
  }
}

variable "region" {
  description = "Region de GCP donde se crean las subredes."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zona concreta donde se crean las VMs."
  type        = string
  default     = "us-central1-a"
}

# Red: VPC de YoUSAC y sus tres capas.
variable "network_name" {
  description = "Nombre de la red virtual privada de YoUSAC."
  type        = string
  default     = "vpc-yousac"
}

variable "vpc_cidr" {
  description = "Rango CIDR de la VPC. Debe contener a las tres subredes."
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr debe ser un CIDR valido, por ejemplo 10.20.0.0/16."
  }
}

variable "subnet_perimetral" {
  description = "Nombre de la subred de la capa perimetral (ingress / borde)."
  type        = string
  default     = "subnet-yousac-perimetral"
}

variable "subnet_perimetral_cidr" {
  description = "Rango CIDR de la subred perimetral."
  type        = string
  default     = "10.20.1.0/24"
}

variable "subnet_aplicacion" {
  description = "Nombre de la subred de la capa de aplicacion (VMs de servicio)."
  type        = string
  default     = "subnet-yousac-aplicacion"
}

variable "subnet_aplicacion_cidr" {
  description = "Rango CIDR de la subred de aplicacion."
  type        = string
  default     = "10.20.2.0/24"
}

variable "subnet_datos" {
  description = "Nombre de la subred de la capa de datos (ELK, bases de datos externas)."
  type        = string
  default     = "subnet-yousac-datos"
}

variable "subnet_datos_cidr" {
  description = "Rango CIDR de la subred de datos."
  type        = string
  default     = "10.20.3.0/24"
}

# Recursos gestionados (los que Terraform adopta mediante import).
variable "gke_cluster_name" {
  description = "Cluster GKE Autopilot de produccion, adoptado por Terraform via bloque import."
  type        = string
  default     = "yousac-prod"
}

variable "gke_network_name" {
  description = "Red donde vive el cluter GKE adoptado. El cluter Autopilot de YoUSAC esta en la red default (VPC-native) y NO se migra para evitar downtime de produccion."
  type        = string
  default     = "default"
}

variable "gke_subnetwork_name" {
  description = "Subred donde vive el cluter GKE adoptado."
  type        = string
  default     = "default"
}

variable "sql_instance_name" {
  description = "Instancia gestionada Cloud SQL (PostgreSQL) con las 6 bases logicas de YoUSAC."
  type        = string
  default     = "yousac-p6-db"
}

variable "postgres_password" {
  description = "Contrasena del usuario yousac de Cloud SQL. Se inyecta por entorno (TF_VAR_postgres_password) y nunca se guarda en el repositorio."
  type        = string
  sensitive   = true
  default     = null

  validation {
    condition     = var.postgres_password == null || length(var.postgres_password) >= 12
    error_message = "postgres_password debe medir al menos 12 caracteres si se define."
  }
}

variable "bucket_videos" {
  description = "Bucket de GCS para los videos grabados."
  type        = string
  default     = "yousac-videos"
}

variable "bucket_material" {
  description = "Bucket de GCS para el material de laboratorio adjunto."
  type        = string
  default     = "yousac-material"
}

variable "artifact_repository_id" {
  description = "Repositorio de Artifact Registry donde el pipeline sube las 8 imagenes."
  type        = string
  default     = "yousac"
}

variable "static_ip_name" {
  description = "Direccion IP global estatica que usa el Ingress del cluter GKE."
  type        = string
  default     = "yousac-prod-ip"
}

variable "cloudsql_proxy_sa" {
  description = "Cuenta de servicio que usan los sidecars de Cloud SQL Auth Proxy."
  type        = string
  default     = "yousac-cloudsql-proxy@yousac-202300396-2026.iam.gserviceaccount.com"
}

variable "gateway_storage_sa" {
  description = "Cuenta de servicio con Workload Identity para que el Gateway escriba en GCS."
  type        = string
  default     = "yousac-gateway-storage@yousac-202300396-2026.iam.gserviceaccount.com"
}

# Direccionamiento interno estatico: la IP interna es un valor conocido de
# antemano, no un alquiler dinamico. Eso permite escribir reglas de firewall y
# entradas de DNS estables.
variable "development_internal_ip" {
  description = "IP privada estatica de vm-dev-yousac."
  type        = string
  default     = "10.20.2.10"

  validation {
    condition     = can(cidrhost("${var.development_internal_ip}/32", 0))
    error_message = "development_internal_ip debe ser una direccion IPv4 valida, por ejemplo 10.20.2.10."
  }
}

variable "observability_internal_ip" {
  description = "IP privada estatica de vm-observability-yousac (nodo de ELK)."
  type        = string
  default     = "10.20.3.10"

  validation {
    condition     = can(cidrhost("${var.observability_internal_ip}/32", 0))
    error_message = "observability_internal_ip debe ser una direccion IPv4 valida, por ejemplo 10.20.3.10."
  }
}

# Computo.
variable "development_instance_name" {
  description = "Nombre de la VM de desarrollo, donde corre Docker Compose."
  type        = string
  default     = "vm-dev-yousac"
}

variable "development_machine_type" {
  description = "Tipo de maquina de la VM de desarrollo. e2-micro esta en el nivel gratuito de us-central1."
  type        = string
  default     = "e2-micro"
}

variable "observability_instance_name" {
  description = "Nombre de la VM de observabilidad, donde corren Elasticsearch, Logstash y Kibana."
  type        = string
  default     = "vm-observability-yousac"
}

variable "observability_machine_type" {
  description = "Tipo de maquina de la VM de observabilidad. Elasticsearch necesita 8 GB de RAM (e2-standard-2)."
  type        = string
  default     = "e2-standard-2"
}

variable "boot_disk_image" {
  description = "Imagen de sistema operativo de las VMs."
  type        = string
  default     = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
}

variable "boot_disk_size_gb" {
  description = "Tamano del disco de arranque de la VM de desarrollo en GB."
  type        = number
  default     = 30

  validation {
    condition     = var.boot_disk_size_gb >= 20
    error_message = "boot_disk_size_gb debe ser al menos 20 GB."
  }
}

variable "observability_disk_size_gb" {
  description = "Tamano del disco de la VM de observabilidad. Elasticsearch se queda sin espacio con 30 GB."
  type        = number
  default     = 60

  validation {
    condition     = var.observability_disk_size_gb >= 50
    error_message = "observability_disk_size_gb debe ser al menos 50 GB para el stack ELK."
  }
}

# Acceso por SSH. No se pide contrasena: se instala la clave publica en los
# metadatos y cloud-init la agrega al authorized_keys del usuario.
variable "ssh_username" {
  description = "Usuario de Linux al que se asigna la clave publica."
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key_paths" {
  description = "Rutas locales a los .pub autorizados en las VMs (una por integrante). Son rutas de la maquina que ejecuta Terraform, no recursos de la nube."
  type        = list(string)
  default     = ["~/.ssh/yousac_ed25519.pub"]

  validation {
    condition     = length(var.ssh_public_key_paths) > 0
    error_message = "ssh_public_key_paths debe tener al menos una clave publica."
  }
}

variable "ssh_private_key_path" {
  description = "Clave privada que usa Ansible (se escribe en el inventario). Debe corresponder a una de ssh_public_key_paths."
  type        = string
  default     = "~/.ssh/yousac_ed25519"
}

# Reglas de firewall.
variable "allowed_ssh_cidr" {
  description = "Origen permitido para el puerto 22. El default es el rango de Identity-Aware Proxy: las VMs no exponen SSH publicamente."
  type        = string
  default     = "35.235.240.0/20"

  validation {
    condition     = can(cidrhost(var.allowed_ssh_cidr, 0))
    error_message = "allowed_ssh_cidr debe ser un CIDR valido."
  }
}

variable "gke_source_ranges" {
  description = "Rangos origen que llegan a la VM de observabilidad desde el cluter GKE (red default + rangos de pods). Fluent Bit envia logs a Logstash y el proxy de Kibana consulta 5601."
  type        = list(string)
  default     = ["10.128.0.0/10", "172.16.0.0/12"]
}

variable "network_tags" {
  description = "Etiquetas de red de las VMs. Las reglas de firewall las referencian en vez de apuntar a IPs."
  type        = list(string)
  default     = ["yousac-vm"]
}

variable "development_tag" {
  description = "Etiqueta que distingue la VM de desarrollo."
  type        = string
  default     = "development"
}

variable "observability_tag" {
  description = "Etiqueta que distingue la VM de observabilidad (ELK)."
  type        = string
  default     = "observability"
}

variable "labels" {
  # Restricciones de Google Cloud: solo minusculas, digitos, guion y guion
  # bajo; deben empezar por letra minuscula; maximo 63 caracteres. Por eso
  # matricula lleva el prefijo carnet- (no puede empezar con digito).
  description = "Etiquetas adjuntas a la red, las subredes y las VMs, visibles en la consola."
  type        = map(string)
  default = {
    proyecto   = "yousac"
    fase       = "fase-3"
    carrera    = "sistemas"
    grupo      = "g4"
    matricula  = "carnet-202307691"
    gestionado = "terraform"
  }

  validation {
    condition     = alltrue([for k in keys(var.labels) : can(regex("^[a-z][-a-z0-9_]*[a-z0-9]$", k))])
    error_message = "Cada clave de labels debe empezar por minuscula y solo contener minusculas, digitos, guion y guion bajo."
  }

  validation {
    condition     = alltrue([for v in values(var.labels) : length(v) <= 63 && can(regex("^[a-z][-a-z0-9_]*$", v))])
    error_message = "Cada valor de labels debe empezar por letra minuscula, medir maximo 63 caracteres y solo contener minusculas, digitos, guion y guion bajo."
  }
}
