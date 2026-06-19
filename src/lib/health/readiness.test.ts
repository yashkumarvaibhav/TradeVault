import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./readiness";

describe("readiness contract", () => {
  it("reports an unconfigured database honestly without attempting a connection", async () => {
    const checkDatabase = vi.fn();
    await expect(checkReadiness({ databaseUrl: null, checkDatabase })).resolves.toEqual({
      ready: false,
      database: "not_configured",
    });
    expect(checkDatabase).not.toHaveBeenCalled();
  });

  it("distinguishes a reachable database from a failed dependency", async () => {
    await expect(checkReadiness({ databaseUrl: "postgresql://db/tradevault", checkDatabase: vi.fn().mockResolvedValue(undefined) }))
      .resolves.toEqual({ ready: true, database: "reachable" });
    await expect(checkReadiness({ databaseUrl: "postgresql://db/tradevault", checkDatabase: vi.fn().mockRejectedValue(new Error("offline")) }))
      .resolves.toEqual({ ready: false, database: "unreachable" });
  });
});
