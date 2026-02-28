# TradeVault Cloud Deploy (Subdomain)

Target URL: `https://tradevault.yashkumarvaibhav.me`

This project is a Flask backend app, so it cannot run on GitHub Pages directly.

## 1) Push this repo to GitHub

Ensure these files are present:
- `render.yaml`
- `Procfile`
- `requirements.txt`

## 2) Deploy on Render

1. Go to Render dashboard.
2. Create a **Web Service** from your GitHub repo.
3. Render will read `render.yaml` and configure:
   - Gunicorn start command
   - persistent disk (`/var/data`)
   - env vars (`SECRET_KEY`, `TRADEVAULT_DB_PATH`, `SESSION_COOKIE_SECURE`)
4. Wait for first deploy to complete.

## 3) Add custom domain

1. In Render service settings, open **Custom Domains**.
2. Add: `tradevault.yashkumarvaibhav.me`
3. Render will show a CNAME target, usually something like `your-service.onrender.com`.

## 4) Update DNS

In your DNS provider (where `yashkumarvaibhav.me` records are managed), add:
- Type: `CNAME`
- Name/Host: `tradevault`
- Value/Target: `<your-render-service>.onrender.com`
- Proxy: DNS only (if Cloudflare)

After DNS propagates and SSL is issued, open:
`https://tradevault.yashkumarvaibhav.me`

## 5) Ongoing updates

Push to the connected GitHub branch; Render auto-deploys.

## Supabase note

Render-only setup for this app:
- Host app on Render
- Keep SQLite on Render persistent disk
- Accept cold starts on Render Free after inactivity
