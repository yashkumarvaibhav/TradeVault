#!/usr/bin/env bash
#
# Restore a custom-format dump into the dedicated TradeVault Postgres.
#
#   scripts/db-restore.sh <dump-file>
#
# DESTRUCTIVE: --clean --if-exists drops and recreates objects in the target
# database. Stop the app first (systemctl --user stop tradevault-v2.service) if
# you want a quiet restore. Credentials come from the gitignored infra env file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/infra/tradevault-db.env"
CONTAINER="tradevault-postgres"

DUMP="${1:?usage: scripts/db-restore.sh <dump-file>}"
[ -f "$DUMP" ] || { echo "No such dump: $DUMP" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Missing secret env file: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < "$DUMP"

echo "Restored $DUMP into $POSTGRES_DB"
