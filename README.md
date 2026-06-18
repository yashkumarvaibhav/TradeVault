# TradeVault

TradeVault is a Flask trading journal deployed on this VM at:

https://tradevault.yashkumarvaibhav.me

The current production setup is intentionally VM-first:

- Flask + Gunicorn on `127.0.0.1:8011`
- SQLite database at `TRADEVAULT_DB_PATH`
- Cloudflare Tunnel in front of the local service
- No Render runtime
- No Supabase runtime database

## Local Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

For production, set a long random `SECRET_KEY` and keep `SESSION_COOKIE_SECURE=true`.

## Production Service

The live service currently runs as a user systemd unit:

```bash
systemctl --user status tradevault-app.service
systemctl --user restart tradevault-app.service
journalctl --user -u tradevault-app.service -f
```

The health check is:

```bash
curl -fsS http://127.0.0.1:8011/healthz
curl -fsS https://tradevault.yashkumarvaibhav.me/healthz
```

## Environment

Required variables:

- `SECRET_KEY`: stable Flask session signing key.
- `TRADEVAULT_DB_PATH`: durable SQLite database path.
- `SESSION_COOKIE_SECURE`: `true` for HTTPS production.

Optional variables:

- `TRADEVAULT_MAX_UPLOAD_BYTES`: max import upload size, default `5242880`.
- `DATABASE_URL`: only for temporary Postgres migration work. Leave unset in production.

## Data Migration

If old data must be pulled from a Postgres source, use:

```bash
SOURCE_DATABASE_URL='postgresql://...' .venv/bin/python scripts/migrate_postgres_to_sqlite.py --replace /home/siddhartha/TradeVault/data/trading_journal.db
```

The app should run from SQLite on the VM after migration.

## Backups

SQLite backup command:

```bash
sqlite3 /home/siddhartha/TradeVault/data/trading_journal.db ".backup '/home/siddhartha/TradeVault/backups/trading_journal_$(date +%Y%m%d_%H%M%S).db'"
```

Recommended production habit: run the backup command from cron/systemd timer and occasionally restore a copy into a temp path to verify it.

## Verification

Useful checks after code changes:

```bash
.venv/bin/python -m py_compile app.py
.venv/bin/python -m unittest discover -s tests
node --check static/js/app.js
curl -fsS http://127.0.0.1:8011/healthz
curl -fsS https://tradevault.yashkumarvaibhav.me/healthz
```
