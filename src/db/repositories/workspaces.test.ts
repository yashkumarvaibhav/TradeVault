import { describe, expect, it } from "vitest";

import { normalizeTenantSlug, normalizeUsername, tenantScope } from "./workspaces";

describe("tenant-scoped repository boundary", () => {
  it("normalizes legacy-compatible usernames and tenant slugs", () => {
    expect(normalizeUsername("  The_StopSniper ")).toBe("the_stopsniper");
    expect(normalizeTenantSlug(" Yash's Trading Vault ")).toBe("yash-s-trading-vault");
  });

  it("brands only valid tenant and user UUID pairs as a scope", () => {
    const scope = tenantScope({
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    });
    expect(scope.tenantId).toBe("11111111-1111-4111-8111-111111111111");
    expect(() => tenantScope({ tenantId: "not-a-uuid", userId: scope.userId })).toThrow("valid tenant and user UUIDs");
  });
});
