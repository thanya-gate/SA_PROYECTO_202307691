###############################################################################
# variables.tf - Entradas del modulo.
#
# Todo lo que un evaluador pueda querer cambiar
# es una variable con valor por defecto
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

# Red: VPC y subredes.
variable "network_name" {
  description = "Nombre de la red virtual privada."
  type        = string
  default     = "vpc-academix-pass"
}

variable "vpc_cidr" {
  description = "Rango CIDR de la VPC. Debe contener a las dos subredes."
  type        = string
  default     = "10.10.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr debe ser un CIDR valido, por ejemplo 10.10.0.0/16."
  }
}

variable "subnet_development" {
  description = "Nombre de la subred del entorno de desarrollo."
  type        = string
  default     = "subnet-development"
}

variable "subnet_development_cidr" {
  description = "Rango CIDR de la subred de desarrollo."
  type        = string
  default     = "10.10.1.0/24"
}

variable "subnet_production" {
  description = "Nombre de la subred del cluster de produccion K3s."
  type        = string
  default     = "subnet-production"
}

variable "subnet_production_cidr" {
  description = "Rango CIDR de la subred de produccion."
  type        = string
  default     = "10.10.2.0/24"
}

# Direccionamiento interno estatico: la IP interna es un valor conocido de
# antemano, no un alquiler dinamico. Eso permite escribir reglas de firewall y
# entradas de DNS estables.
variable "development_internal_ip" {
  description = "IP privada estatica de vm-development."
  type        = string
  default     = "10.10.1.10"

  # La pertenencia al rango de la subred no se comprueba aqui a proposito: HCL
  # no tiene una funcion para eso, y la API de Compute Engine ya rechaza la
  # instancia en el apply si la IP queda fuera del CIDR.
  validation {
    condition     = can(cidrhost("${var.development_internal_ip}/32", 0))
    error_message = "development_internal_ip debe ser una direccion IPv4 valida, por ejemplo 10.10.1.10."
  }
}

variable "production_internal_ip" {
  description = "IP privada estatica de vm-production-k3s."
  type        = string
  default     = "10.10.2.10"

  validation {
    condition     = can(cidrhost("${var.production_internal_ip}/32", 0))
    error_message = "production_internal_ip debe ser una direccion IPv4 valida, por ejemplo 10.10.2.10."
  }
}

# Computo.
variable "development_instance_name" {
  description = "Nombre de la VM de desarrollo, donde corre Docker Compose."
  type        = string
  default     = "vm-development"
}

variable "development_machine_type" {
  description = "Tipo de maquina de la VM de desarrollo. e2-micro esta en el nivel gratuito de us-central1."
  type        = string
  default     = "e2-micro"
}

variable "production_instance_name" {
  description = "Nombre de la VM de produccion, donde corre el control-plane de K3s."
  type        = string
  default     = "vm-production-k3s"
}

variable "production_machine_type" {
  description = "Tipo de maquina de la VM de produccion. e2-medium = 2 vCPU / 4 GB."
  type        = string
  default     = "e2-medium"
}

variable "boot_disk_image" {
  description = "Imagen de sistema operativo de ambas VMs."
  type        = string
  default     = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
}

variable "boot_disk_size_gb" {
  description = "Tamano del disco de arranque en GB. K3s se queda sin espacio con las 10 GB por defecto."
  type        = number
  default     = 30

  validation {
    condition     = var.boot_disk_size_gb >= 20
    error_message = "boot_disk_size_gb debe ser al menos 20: K3s se queda sin espacio con los 10 GB por defecto."
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
  default     = ["~/.ssh/academix_pass_ed25519.pub"]

  validation {
    condition     = length(var.ssh_public_key_paths) > 0
    error_message = "ssh_public_key_paths debe tener al menos una clave publica."
  }
}

variable "ssh_private_key_path" {
  description = "Clave privada que usa Ansible (se escribe en el inventario). Debe corresponder a una de ssh_public_key_paths."
  type        = string
  default     = "~/.ssh/academix_pass_ed25519"
}

# Reglas de firewall.
variable "allowed_ssh_cidr" {
  description = "Origen permitido para el puerto 22. En produccion conviene 35.235.240.0/20 (Identity-Aware Proxy) en vez de 0.0.0.0/0."
  type        = string
  default     = "0.0.0.0/0"

  validation {
    condition     = can(cidrhost(var.allowed_ssh_cidr, 0))
    error_message = "allowed_ssh_cidr debe ser un CIDR valido."
  }
}

variable "allowed_http_cidr" {
  description = "Origen permitido para el puerto 80."
  type        = string
  default     = "0.0.0.0/0"
}

variable "allowed_https_cidr" {
  description = "Origen permitido para el puerto 443."
  type        = string
  default     = "0.0.0.0/0"
}

variable "allowed_k3s_api_cidr" {
  description = "Origen permitido para el puerto 6443 (API server de K3s)."
  type        = string
  default     = "0.0.0.0/0"
}

variable "network_tags" {
  description = "Etiquetas de red de las VMs. Las reglas de firewall las referencian en vez de apuntar a IPs."
  type        = list(string)
  default     = ["academix-pass"]
}

variable "environment_tag" {
  description = "Etiqueta que distingue el entorno de produccion."
  type        = string
  default     = "production"
}

variable "labels" {
  # Restricciones de Google Cloud: solo minusculas, digitos, guion y guion
  # bajo; deben empezar por letra minuscula; maximo 63 caracteres. Por eso
  # matricula lleva el prefijo carnet- (no puede empezar con digito).
  description = "Etiquetas adjuntas a la red, las subredes y las VMs, visibles en la consola."
  type        = map(string)
  default = {
    proyecto   = "academix-pass"
    carrera    = "sistemas"
    practica   = "practica-9"
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