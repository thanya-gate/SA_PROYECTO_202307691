#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  echo "TEST_DATABASE_URL es obligatorio y debe apuntar a una base PostgreSQL temporal." >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$script_dir/../../../sql/catalogo.sql" \
  -f "$script_dir/catalogo-contract.sql"
