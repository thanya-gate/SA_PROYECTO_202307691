###############################################################################
# ansible.tf - Puente entre Terraform y Ansible.
#
# Las IPs publicas son efimeras: cambian en cada destroy/apply. Por eso el
# inventario no se escribe a mano, lo genera Terraform con los valores reales
# al terminar el apply. Asi `ansible-playbook -i inventory.ini site.yml` corre
# justo despues sin editar nada.
###############################################################################

resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../ansible/inventory.ini"
  file_permission = "0644"

  content = templatefile("${path.module}/templates/inventory.ini.tftpl", {
    ssh_username         = var.ssh_username
    ssh_private_key_path = var.ssh_private_key_path

    development_name        = google_compute_instance.development.name
    development_public_ip   = google_compute_instance.development.network_interface[0].access_config[0].nat_ip
    development_internal_ip = google_compute_instance.development.network_interface[0].network_ip

    production_name        = google_compute_instance.production.name
    production_public_ip   = google_compute_instance.production.network_interface[0].access_config[0].nat_ip
    production_internal_ip = google_compute_instance.production.network_interface[0].network_ip
  })
}
