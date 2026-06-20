import { describe, expect, it } from "vitest";

import { parseTradeScope, scopeDateKeys, scopeDateWindow, scopeHref } from "./trade-scope";

describe("dashboard date scope", () => {
  it("parses and serializes an inclusive custom range with asset scope", () => {
    const scope = parseTradeScope({ period: "custom", from: "2026-06-10", to: "2026-06-20", asset: "Forex" });
    expect(scope).toEqual({ period: "custom", from: "2026-06-10", to: "2026-06-20", asset: "Forex", rangeError: undefined });
    expect(scopeHref("/analytics", scope, {})).toBe("/analytics?period=custom&from=2026-06-10&to=2026-06-20&asset=Forex");
    expect(scopeHref("/analytics", scope, { period: "30d" })).toBe("/analytics?period=30d&asset=Forex");
  });

  it("reports missing, invalid, and reversed custom ranges", () => {
    expect(parseTradeScope({ period: "custom", from: "2026-06-10" }).rangeError).toBe("Choose both From and To dates.");
    expect(parseTradeScope({ period: "custom", from: "2026-06-20", to: "2026-06-10" }).rangeError).toBe("From must be on or before To.");
    expect(parseTradeScope({ period: "custom", from: "2026-02-30", to: "2026-03-01" }).rangeError).toBe("Choose both From and To dates.");
  });

  it("resolves presets and custom days against the configured timezone", () => {
    const now = new Date("2026-01-01T20:00:00Z");
    expect(scopeDateKeys({ period: "30d", asset: "Overall" }, now, "Asia/Kolkata")).toEqual({ from: "2025-12-04", to: "2026-01-02" });
    const window = scopeDateWindow({ period: "custom", asset: "Overall", from: "2026-06-10", to: "2026-06-10" }, now, "Asia/Kolkata");
    expect(window?.start.toISOString()).toBe("2026-06-09T18:30:00.000Z");
    expect(window?.endExclusive.toISOString()).toBe("2026-06-10T18:30:00.000Z");
  });
});
