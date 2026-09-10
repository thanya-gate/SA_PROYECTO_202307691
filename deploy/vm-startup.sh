#!/usr/bin/env bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg docker.io docker-compose-v2

# Google Cloud CLI permite que Docker renueve las credenciales usando la cuenta
# de servicio adjunta a la VM, sin guardar una llave JSON en el servidor.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
  | gpg --dearmor --yes -o /etc/apt/keyrings/google-cloud.gpg
echo "deb [signed-by=/etc/apt/keyrings/google-cloud.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
  > /etc/apt/sources.list.d/google-cloud-sdk.list
apt-get update
apt-get install -y google-cloud-cli

systemctl enable --now docker
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet || true

install -d -m 0755 /opt/yousac /mnt/media/videos
touch /opt/yousac/startup.ready
