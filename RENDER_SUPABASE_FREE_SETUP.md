# Render + Supabase (Free) Setup

Target URL: `https://tradevault.yashkumarvaibhav.me`

## 1) Supabase connection string

1. Open Supabase project dashboard.
2. Go to **Project Settings -> Database -> Connection string**.
3. Copy the **Postgres** URL (pooler URL preferred).
4. Ensure it includes SSL (add `?sslmode=require` if not present).
5. If your DB password contains `@`, use `%40` in the URL.

## 2) Deploy on Render (Free)

1. Open Render dashboard -> **New -> Blueprint**.
2. Connect repo `yashkumarvaibhav/TradeVault` (branch `main`).
3. Render reads `render.yaml` (free web service).
4. In environment variables, set:
   - `DATABASE_URL` = your Supabase Postgres URL
   - `SECRET_KEY` = long random string (if not auto-generated)
   - `SESSION_COOKIE_SECURE` = `true`
5. Deploy.

## 3) Optional: migrate existing local SQLite data

If you want your existing local data moved to Supabase:

```bash
DATABASE_URL='<supabase-url>' python scripts/migrate_sqlite_to_postgres.py
```

## 4) Custom domain

1. In Render service settings, open **Custom Domains**.
2. Add `tradevault.yashkumarvaibhav.me`.
3. In DNS, add CNAME:
   - Host: `tradevault`
   - Target: `<your-render-service>.onrender.com`

## 5) Free-tier behavior

- Render Free: service sleeps after inactivity and cold-starts on next request.
- Supabase Free: projects may pause after extended inactivity.
