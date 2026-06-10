#!/usr/bin/env bash
# Apply the gto-schema migration to a target Postgres (the shared Supabase
# project, daily-command-center). One-shot: the dumped DDL uses plain
# CREATE TABLE and 02 inserts rows, so apply once into a fresh gto schema.
# To re-run from scratch: DROP SCHEMA gto CASCADE; on the target, then re-apply.
#
# Usage:
#   TARGET_DATABASE_URL='postgresql://postgres.<ref>:<pw>@<pooler-host>:5432/postgres' \
#     bash apply-to-target.sh [--schema-only|--data-only]
#
# Always forces UTF-8 so the box-drawing chars in comments load cleanly.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL to the shared project connection string}"
export PGCLIENTENCODING=UTF8
export PGCONNECT_TIMEOUT=25

mode="${1:-all}"

run() { echo "[apply] $1"; psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$here/$2"; }

if [[ "$mode" != "--data-only" ]]; then
  run "schema -> gto" 01_schema_gto.sql
fi
if [[ "$mode" != "--schema-only" ]]; then
  [[ -f "$here/02_data_gto.sql" ]] || { echo "02_data_gto.sql missing — run build-migration.sh first"; exit 1; }
  run "data -> gto" 02_data_gto.sql
fi

echo "[apply] verification — gto row counts:"
psql "$TARGET_DATABASE_URL" -At -F'|' -c "
select string_agg(format('select %L t, count(*) c from gto.%I', tablename, tablename), ' union all ' order by tablename)
from pg_tables where schemaname='gto';" | psql "$TARGET_DATABASE_URL" -At -F'|' -f - | sort
echo "[apply] done."
