# Go-public cutover & v1 decommission runbook

How to move from the retired v1 Flask app to TradeVault v2 and retire v1 safely.

**Decision (owner, 2026-06-21):** data import is **operator-run, not a user-facing wizard.** Users do not
self-import; the owner hands the operator a v1 export and the import is run for them. Billing is descoped
(the app is free). Price-chart/replay + automatic excursion capture stay out of scope (blocked on the
data-source decision).

The import engine itself was built in P11 (`/reports` → Import, plus `POST /api/data-transfer/import`).
It accepts the v1/v2/v3 `tradevault_export` JSON formats, validates the whole file before an atomic
transaction, recomputes derived trade math through the domain oracle, relinks references only within the
target tenant, and is **idempotent** (re-running reports stable duplicate skips).

---

## 1. Export each account's data from v1 (do this BEFORE decommissioning v1)

The v1 Flask app is stopped + disabled, and its code was removed from this repo (a DB snapshot is kept at
`../backups/v1-snapshot-2026-06-19/`). To produce the `tradevault_export` JSON the v2 importer expects:

- **Preferred:** temporarily start the v1 service, sign in as each user, and use v1's existing export to
  download their JSON. Stop v1 again afterwards.
  - Do **not** edit the `gwiz` Cloudflare tunnel to expose v1; run/export over loopback only.
- **Or:** restore `../backups/v1-snapshot-2026-06-19/` into a throwaway Postgres and export from there.

Save one JSON file per account (e.g. `infra/migration/<username>.json`, gitignored). Note: attachment
**binaries** are not part of the export (it carries attachment counts only) — migrate any v1 upload files
out-of-band if they must be preserved.

## 2. Import into v2 (operator-run)

For each account:

1. Ensure the target v2 account exists (the owner creates it at `/signup`, or it already exists).
2. Sign in to v2 as that account and open **`/reports` → Import**, or call the gated
   `POST /api/data-transfer/import` with the same session.
3. Upload the account's v1 JSON. The importer validates first; on success it commits atomically.
4. **Verify:** `/trades` row counts and `/analytics` per-currency KPIs match the source; spot-check a few
   trades' R and P&L. Re-running the import is safe (idempotent) if you need to confirm.

Keep INR and USD reasoning intact — every imported metric stays per-currency; nothing is summed across
currencies.

## 3. Decommission v1 Flask

1. **Service:** confirm v1 is down for good —
   `systemctl --user is-active tradevault-app.service` → `inactive`,
   `systemctl --user is-enabled tradevault-app.service` → `disabled`. (Already the case; do not restart it.)
2. **Tunnel (owner only):** confirm `~/.cloudflared/config.yml` routes
   `tradevault.yashkumarvaibhav.me` → `127.0.0.1:8011` (v2). The public site already serves v2, so this is
   likely already in place — just verify. **Agents must never edit the `gwiz` tunnel or `~/.cloudflared/`.**
3. **Backups:** retain `../backups/v1-snapshot-2026-06-19/` until every account's migration is verified,
   then archive it off-box. Add the v2 dedicated Postgres and `var/uploads` to the off-box backup before
   go-public (the `db-backup.sh` script is still manual).
4. Remove any leftover v1 artifacts (gunicorn unit file, virtualenv) once the snapshot is archived.

## 4. Post-cutover checks

- Public: `/`, `/features`, `/faq`, `/login`, `/signup`, `/sitemap.xml`, `/robots.txt` all 200; gated app
  routes 307 → `/login` when signed out.
- `tradevault-v2.service` active; `/api/ready` 200; migrations applied.
- Each migrated account can sign in and sees its trades/analytics.
