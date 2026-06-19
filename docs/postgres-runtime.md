# TradeVault v2 — Postgres runtime (dedicated, persistent)

The app is backed by a dedicated PostgreSQL 17 instance defined in
[`compose.yaml`](../compose.yaml). It is **loopback-only on host port `5544`** and
fully isolated from the unrelated `placement-tracker-postgres` (`127.0.0.1:5433`),
which must never be touched.

## Topology

| Piece | Value |
|---|---|
| Compose service | `postgres` (`postgres:17-alpine`), container `tradevault-postgres` |
| Host bind | `127.0.0.1:5544` → container `5432` (loopback only) |
| Persistent volume | `tradevault_pgdata` (survives `docker compose down`) |
| Database / role | `tradevault` / `tradevault` |
| App connection | `tradevault-v2.service` reads `DATABASE_URL` via `EnvironmentFile` |
| Migrations | Drizzle (`drizzle/`), ledger `drizzle.__tradevault_migrations` |

## Secrets

Credentials live in `infra/tradevault-db.env` — **gitignored, `chmod 600`, never
committed**. One file is shared by two consumers:

- `compose.yaml` (`env_file`) uses `POSTGRES_USER` / `POSTGRES_PASSWORD` /
  `POSTGRES_DB` to initialize the container.
- `~/.config/systemd/user/tradevault-v2.service` (`EnvironmentFile=-…`) reads
  `DATABASE_URL` for the running app. The leading `-` lets the unit start even if
  the file is absent (readiness then honestly reports `not_configured`).

To rotate the password: stop the app, update the password in the env file **and**
inside the container (`ALTER ROLE tradevault WITH PASSWORD …`), keep `DATABASE_URL`
in sync, then restart the service.

## Operate

```bash
# Start / status / logs
docker compose up -d
docker compose ps                 # expect "Up (healthy)"
docker compose logs -f postgres

# Apply migrations (loads DATABASE_URL from the env file)
set -a; . infra/tradevault-db.env; set +a
npm run db:migrate

# Connect a psql shell
docker exec -it -e PGPASSWORD="$POSTGRES_PASSWORD" tradevault-postgres \
  psql -U tradevault -d tradevault

# App lifecycle
systemctl --user restart tradevault-v2.service
curl -s http://127.0.0.1:8011/api/ready        # -> {"status":"ready",...,"database":"reachable"}
```

`/api/ready` returns **200** when the database is reachable and **503**
(`database:not_configured` or `database:unreachable`) otherwise. `/api/health` is
dependency-free liveness and stays 200 regardless.

## Backup & restore

Custom-format dumps (`-Fc`) land in the gitignored `infra/backups/` directory.

```bash
# Back up (timestamped file under infra/backups/)
scripts/db-backup.sh
# -> Wrote infra/backups/tradevault-YYYYMMDD-HHMMSSZ.dump

# Inspect a dump without restoring
docker exec -i tradevault-postgres pg_restore --list < infra/backups/<file>.dump

# Restore (DESTRUCTIVE: --clean --if-exists). Stop the app first for a quiet restore.
systemctl --user stop tradevault-v2.service
scripts/db-restore.sh infra/backups/<file>.dump
systemctl --user start tradevault-v2.service
```

Both scripts read credentials from `infra/tradevault-db.env`. For off-box safety,
copy `infra/backups/*.dump` to durable storage on a schedule (cron / external job)
— that is intentionally not wired here so it stays under owner control.

## Do not

- Touch `placement-tracker-postgres` (`:5433`), the `gwiz` Cloudflare tunnel, or
  `~/.cloudflared/`.
- Expose Postgres beyond `127.0.0.1`. The bind is loopback-only by design.
- Commit `infra/tradevault-db.env` or anything under `infra/backups/`.
