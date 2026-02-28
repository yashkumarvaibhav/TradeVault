# Supabase Commit-Ready Setup

This repo is now wired to run on Supabase Postgres via `DATABASE_URL`.

## 1) Create a Supabase project

- In Supabase dashboard, create a new project.
- Open **Project Settings -> Database -> Connection string**.
- Copy a Postgres connection URL (pooler is recommended) and append `?sslmode=require` if needed.

Example:

```bash
postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
```

## 2) Set environment variables

Required:

```bash
SECRET_KEY=<long-random-secret>
DATABASE_URL=<supabase-postgres-url>
SESSION_COOKIE_SECURE=true
```

Optional fallback (used only if `DATABASE_URL` is empty):

```bash
TRADEVAULT_DB_PATH=./trading_journal.db
```

## 3) Migrate existing local SQLite data (optional)

If you already have data in `trading_journal.db` and want it in Supabase:

```bash
DATABASE_URL='<supabase-url>' python scripts/migrate_sqlite_to_postgres.py
```

Or provide a custom sqlite path:

```bash
DATABASE_URL='<supabase-url>' python scripts/migrate_sqlite_to_postgres.py /path/to/trading_journal.db
```

## 4) Run app

```bash
python app.py
```

or production:

```bash
gunicorn -w 2 -b 0.0.0.0:$PORT app:app
```

## Notes

- Supabase provides the Postgres database, not Flask app hosting.
- You still need a host for this Flask app (Render/Railway/Fly/VM/etc).
