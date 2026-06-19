#!/usr/bin/env bash
#
# Back up the dedicated TradeVault Postgres (compose service `postgres`, :5544)
# to a timestamped, gitignored custom-format dump.
#
#   scripts/db-backup.sh [output-dir]   # default: infra/backups/
#
# Custom format (-Fc) so it restores with db-restore.sh / pg_restore and supports
# selective object restore. Credentials come from the gitignored infra env file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/infra/tradevault-db.env"
CONTAINER="tradevault-postgres"

[ -f "$ENV_FILE" ] || { echo "Missing secret env file: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

OUT_DIR="${1:-$ROOT/infra/backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
OUT="$OUT_DIR/tradevault-${STAMP}.dump"

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$OUT"

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
