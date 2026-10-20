#!/usr/bin/env bash
# ============================================================================
# Importa los dashboards/visualizaciones/index pattern de Kibana (Saved Objects)
# hacia el Kibana del stack ELK de YoUSAC.
#
# Uso (desde cualquier host con acceso a Kibana):
#   KIBANA_URL=https://kibana.yousac-thany.duckdns.org \
#   KIBANA_USER=elastic KIBANA_PASSWORD='<password-del-usuario-elastic>' \
#   ./observability/kibana-dashboards/import.sh
#
# Tambien se puede ejecutar en la VM de observabilidad apuntando al Kibana
# interno: KIBANA_URL=http://127.0.0.1:5601
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIBANA_URL="${KIBANA_URL:-http://127.0.0.1:5601}"
KIBANA_USER="${KIBANA_USER:-elastic}"
KIBANA_PASSWORD="${KIBANA_PASSWORD:?Define KIBANA_PASSWORD (password del usuario elastic)}"

CURL_OPTS=(-sS -u "${KIBANA_USER}:${KIBANA_PASSWORD}")
if [[ "${KIBANA_URL}" != http://127.0.0.1:* && "${KIBANA_URL}" != http://localhost:* ]]; then
  CURL_OPTS+=(-k)
fi

echo ">> Importando Saved Objects en ${KIBANA_URL} ..."
# overwrite=true para que el script sea idempotente (reimporta sin duplicar).
curl "${CURL_OPTS[@]}" \
  -X POST "${KIBANA_URL}/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  --form file=@"${SCRIPT_DIR}/yousac-logs.ndjson"

echo
echo ">> Listo. Dashboards disponibles en ${KIBANA_URL}/app/dashboards"
