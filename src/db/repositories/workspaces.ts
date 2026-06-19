import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { tenantMemberships, tenants, tradingAccounts, users } from "@/db/schema";
import type { Currency } from "@/lib/domain/types";

declare const tenantScopeBrand: unique symbol;

export type TenantScope = Readonly<{
  tenantId: string;
  userId: string;
  [tenantScopeBrand]: true;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function tenantScope(input: { tenantId: string; userId: string }): TenantScope {
  if (!uuidPattern.test(input.tenantId) || !uuidPattern.test(input.userId)) {
    throw new Error("Tenant scope requires valid tenant and user UUIDs.");
  }
  return input as TenantScope;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeTenantSlug(slug: string) {
  return slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function provisionWorkspace(db: Database, input: {
  username: string;
  displayUsername?: string;
  displayName?: string;
  tenantSlug: string;
  tenantName: string;
  defaultCurrency?: Currency;
}) {
  const username = normalizeUsername(input.username);
  const tenantSlug = normalizeTenantSlug(input.tenantSlug);
  if (username.length < 3) throw new Error("Username must contain at least 3 characters.");
  if (!tenantSlug) throw new Error("Tenant slug cannot be empty.");
  if (!input.tenantName.trim()) throw new Error("Tenant name cannot be empty.");

  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      username,
      displayUsername: input.displayUsername?.trim() || input.username.trim(),
      displayName: input.displayName?.trim() || null,
    }).returning();

    const [tenant] = await tx.insert(tenants).values({
      slug: tenantSlug,
      name: input.tenantName.trim(),
    }).returning();

    await tx.insert(tenantMemberships).values({ tenantId: tenant.id, userId: user.id, role: "owner" });

    const [account] = await tx.insert(tradingAccounts).values({
      tenantId: tenant.id,
      ownerUserId: user.id,
      name: "Main",
      defaultCurrency: input.defaultCurrency ?? "INR",
      isDefault: true,
    }).returning();

    return { user, tenant, account, scope: tenantScope({ tenantId: tenant.id, userId: user.id }) };
  });
}

export function createTradingAccountRepository(db: Database, scope: TenantScope) {
  const ownedByScope = and(
    eq(tradingAccounts.tenantId, scope.tenantId),
    eq(tradingAccounts.ownerUserId, scope.userId),
  );

  return {
    list: () => db.select().from(tradingAccounts).where(ownedByScope).orderBy(asc(tradingAccounts.createdAt)),
    getDefault: async () => {
      const [account] = await db.select().from(tradingAccounts).where(and(ownedByScope, eq(tradingAccounts.isDefault, true))).limit(1);
      return account ?? null;
    },
  };
}
