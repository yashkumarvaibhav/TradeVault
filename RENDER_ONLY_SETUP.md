# Render-Only Deployment (TradeVault)

Target URL: `https://tradevault.yashkumarvaibhav.me`

This setup uses:
- Render Web Service for Flask app hosting
- SQLite database file on Render persistent disk

## 1) Create service on Render

1. Open Render dashboard.
2. New -> Web Service.
3. Connect GitHub repo: `yashkumarvaibhav/TradeVault`.
4. Render will detect `render.yaml`.

## 2) Verify Render config

Expected from `render.yaml`:
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`
- Health path: `/healthz`
- Persistent disk mounted at `/var/data`

## 3) Environment variables

Set/confirm these in Render:

- `SECRET_KEY` = long random string
- `SESSION_COOKIE_SECURE` = `true`
- `TRADEVAULT_DB_PATH` = `/var/data/trading_journal.db`

## 4) Deploy

- Trigger deploy and wait until status is live.
- Open your Render default URL and verify login/register works.

## 5) Custom domain

1. In Render service -> Settings -> Custom Domains.
2. Add: `tradevault.yashkumarvaibhav.me`
3. Render gives a CNAME target (example: `tradevault.onrender.com`).

In your DNS provider:
- Type: `CNAME`
- Host/Name: `tradevault`
- Value/Target: `<render-cname-target>`
- If using Cloudflare: keep as DNS-only until SSL is issued.

## 6) Important behavior on Free plan

On Render Free, web service may sleep after inactivity and cold-start on next request.
