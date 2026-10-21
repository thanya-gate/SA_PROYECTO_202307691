###############################################################################
# ansible.tf - Puente entre Terraform y Ansible.
#
# Las VMs no llevan IP publica: se llega a ellas por Identity-Aware Proxy. El
# inventario que genera Terraform usa el ProxyCommand de gcloud, de modo que
# `ansible-playbook -i inventory.ini site.yml` funciona sin editar nada.
###############################################################################

resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../ansible/inventory.ini"
  file_permission = "0644"

  content = templatefile("${path.module}/templates/inventory.ini.tftpl", {
    project_id           = var.project_id
    zone                 = var.zone
    ssh_username         = var.ssh_username
    ssh_private_key_path = var.ssh_private_key_path

    development_name        = google_compute_instance.development.name
    development_internal_ip = google_compute_instance.development.network_interface[0].network_ip

    observability_name        = google_compute_instance.observability.name
    observability_internal_ip = google_compute_instance.observability.network_interface[0].network_ip
  })
}

# Aprovisionamiento automatico tras levantar las VMs (exigido por el enunciado).
# Usa el inventario generado y el ProxyCommand de gcloud (IAP). Requiere
# `gcloud auth login/application-default` y permisos iap.tunnelResourceAccessor.
resource "null_resource" "ansible_provision" {
  depends_on = [
    local_file.ansible_inventory,
    google_compute_instance.development,
    google_compute_instance.observability,
  ]

  triggers = {
    inventory_sha = sha256(local_file.ansible_inventory.content)
    dev_id        = google_compute_instance.development.id
    obs_id        = google_compute_instance.observability.id
  }

  provisioner "local-exec" {
    command     = "ansible-playbook -i inventory.ini site.yml"
    working_dir = "${path.module}/../ansible"
  }

  provisioner "local-exec" {
    when        = destroy
    command     = "echo 'Ansible provision ejecutado durante apply; rollback manual si aplica.'"
    working_dir = "${path.module}/../ansible"
  }
}
