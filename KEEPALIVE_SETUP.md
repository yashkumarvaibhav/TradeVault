# Keep Render Awake (Free Plan)

This repo includes a GitHub Actions cron job that pings:
`/healthz` every 10 minutes.

Workflow file:
- `.github/workflows/render_keepalive.yml`

## Enable it

1. Push latest code to GitHub.
2. In GitHub repo -> `Actions`, enable workflows if prompted.
3. Optional (recommended): set repo secret `RENDER_PING_URL` to your exact URL:
   - Example: `https://tradevault.yashkumarvaibhav.me/healthz`
4. Run workflow once manually (`Run workflow`) to verify success.

## Notes

- This reduces cold starts but may consume free instance hours.
- Render can still suspend service if monthly free hours are exhausted.
