import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { migrate as migrateNodePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { createDatabase, type Database } from "../src/db/client";
import { sumMoneyByCurrency } from "../src/db/money";
import * as schema from "../src/db/schema";
import { tradingAccounts } from "../src/db/schema";
import { createTradingAccountRepository, provisionWorkspace, tenantScope } from "../src/db/repositories/workspaces";

async function main() {
const connectionString = process.env.DATABASE_URL;
if (connectionString && process.env.TRADEVAULT_VERIFY_DISPOSABLE_DB !== "1") {
  throw new Error("Refusing database verification without TRADEVAULT_VERIFY_DISPOSABLE_DB=1.");
}

const pglite = connectionString ? null : new PGlite();
const nodePostgres = connectionString ? createDatabase(connectionString) : null;
const pgliteDatabase = pglite ? drizzlePglite(pglite, { schema }) : null;
const db: Database = nodePostgres?.db ?? pgliteDatabase!;
const rawQuery = (query: string) => nodePostgres ? nodePostgres.pool.query(query) : pglite!.query(query);

async function expectPostgresError(operation: () => Promise<unknown>, code: string) {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}`);
  } catch (error) {
    const wrapped = error as { code?: string; cause?: { code?: string } };
    assert.equal(wrapped.code ?? wrapped.cause?.code, code);
  }
}

try {
  const migrationConfig = {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
    migrationsSchema: "drizzle",
    migrationsTable: "__tradevault_migrations",
  };
  if (nodePostgres) await migrateNodePostgres(nodePostgres.db, migrationConfig);
  else await migratePglite(pgliteDatabase!, migrationConfig);

  const yash = await provisionWorkspace(db, {
    username: "YashKumarVaibhav",
    displayUsername: "YashKumarVaibhav",
    tenantSlug: "Yash Vault",
    tenantName: "Yash Vault",
    defaultCurrency: "INR",
  });
  const sniper = await provisionWorkspace(db, {
    username: "Sniper",
    tenantSlug: "Sniper Vault",
    tenantName: "Sniper Vault",
    defaultCurrency: "USD",
  });

  assert.equal(yash.user.username, "yashkumarvaibhav");
  assert.equal(yash.account.name, "Main");
  assert.equal(yash.account.defaultCurrency, "INR");

  const yashAccounts = createTradingAccountRepository(db, yash.scope);
  const sniperAccounts = createTradingAccountRepository(db, sniper.scope);
  assert.equal((await yashAccounts.list()).length, 1);
  assert.equal((await sniperAccounts.list()).length, 1);
  assert.equal((await yashAccounts.getDefault())?.ownerUserId, yash.user.id);

  const crossedScope = tenantScope({ tenantId: yash.tenant.id, userId: sniper.user.id });
  assert.equal((await createTradingAccountRepository(db, crossedScope).list()).length, 0);

  await expectPostgresError(
    () => db.insert(tradingAccounts).values({
      tenantId: yash.tenant.id,
      ownerUserId: yash.user.id,
      name: "Second default",
      defaultCurrency: "USD",
      isDefault: true,
    }),
    "23505",
  );

  await expectPostgresError(
    () => db.insert(tradingAccounts).values({
      tenantId: yash.tenant.id,
      ownerUserId: sniper.user.id,
      name: "Cross-tenant account",
      defaultCurrency: "USD",
      isDefault: false,
    }),
    "23503",
  );

  await expectPostgresError(
    () => rawQuery("select 'EUR'::currency_code"),
    "22P02",
  );
  await expectPostgresError(
    () => rawQuery("insert into users (username, display_username) values ('UpperCase', 'UpperCase')"),
    "23514",
  );

  assert.deepEqual(sumMoneyByCurrency([
    { currency: "INR", amount: 980 },
    { currency: "USD", amount: 50 },
  ]), {
    INR: { currency: "INR", amount: 980 },
    USD: { currency: "USD", amount: 50 },
  });

  const migrationCount = await rawQuery('select count(*) from drizzle."__tradevault_migrations"');
  assert.equal(Number((migrationCount.rows[0] as { count?: string | number } | undefined)?.count), 1);

  const engine = nodePostgres ? "external disposable PostgreSQL" : "in-process PostgreSQL (PGlite)";
  console.log(`Database baseline verified on ${engine}: migration, ownership constraints, tenant isolation, and currency guards are green.`);
} finally {
  if (nodePostgres) await nodePostgres.pool.end();
  else await pglite?.close();
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
