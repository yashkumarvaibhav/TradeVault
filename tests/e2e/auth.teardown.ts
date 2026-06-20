import { test as teardown } from "@playwright/test";
import { Pool } from "pg";

// Remove every throwaway account (and its tenant/accounts/sessions via cascade) the
// e2e run created. Matches the `pw_e2e_` prefix so crashed prior runs are cleaned too.
teardown("delete e2e test users", async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const pool = new Pool({ connectionString });
  try {
    // Trades and notes intentionally retain creator-membership integrity (no-action FK).
    // Remove these test journal rows before deleting their ephemeral workspace; production
    // memberships are untouched.
    const testTenants = `select m.tenant_id from tenant_memberships m
         join users u on u.id = m.user_id
         where u.username like 'pw_e2e_%'`;
    await pool.query(`delete from notes where tenant_id in (${testTenants})`);
    await pool.query(`delete from trades where tenant_id in (${testTenants})`);
    await pool.query(`delete from tenants where id in (${testTenants})`);
    await pool.query("delete from users where username like 'pw_e2e_%'");
  } finally {
    await pool.end();
  }
});
