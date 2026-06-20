import { describe, expect, it } from "vitest";

import { rankVaultSearchCandidates, type VaultSearchCandidate } from "./vault-search";

const candidates: VaultSearchCandidate[] = [
  { id: "trade-new", kind: "trade", title: "RELIANCE", meta: "Long · Closed", href: "/trades/trade-new", currency: "INR", amount: 4200, direction: "Long", status: "closed", searchText: "Equity Cash breakout clean execution", sortAtIso: "2026-06-20T10:00:00.000Z" },
  { id: "trade-old", kind: "trade", title: "AAPL", meta: "Short · Closed", href: "/trades/trade-old", currency: "USD", amount: -118.4, direction: "Short", status: "closed", searchText: "Equity Options mean reversion", sortAtIso: "2026-06-18T10:00:00.000Z" },
  { id: "instrument", kind: "instrument", title: "RELIANCE", meta: "Equity · Cash · INR", href: "/trades?symbol=RELIANCE", currency: "INR", searchText: "Reliance Industries large cap", sortAtIso: "2026-06-10T10:00:00.000Z" },
  { id: "strategy", kind: "strategy", title: "Breakout", meta: "Strategy · Price expansion", href: "/trades?strategyId=strategy", searchText: "Price expansion confirmation", sortAtIso: "2026-06-10T09:00:00.000Z" },
  { id: "playbook", kind: "playbook", title: "Opening range breakout", meta: "Intraday · 3 setup rules", href: "/trades?playbookId=playbook", searchText: "volume confirmation opening range", sortAtIso: "2026-06-10T08:00:00.000Z" },
  { id: "note", kind: "note", title: "Patience over frequency", meta: "Daily journal · Pinned", href: "/notes/note", searchText: "wait for A plus setups weekly intent", sortAtIso: "2026-06-20T11:00:00.000Z" },
];

describe("vault search ranking", () => {
  it("requires every query term and ranks title matches above hidden body matches", () => {
    expect(rankVaultSearchCandidates(candidates, "breakout").map((item) => item.id)).toEqual(["strategy", "playbook", "trade-new"]);
    expect(rankVaultSearchCandidates(candidates, "volume confirmation").map((item) => item.id)).toEqual(["playbook"]);
  });

  it("normalizes case and whitespace", () => {
    expect(rankVaultSearchCandidates(candidates, "  WAIT   a PLUS ").map((item) => item.id)).toEqual(["note"]);
  });

  it("interleaves recent defaults across every record kind", () => {
    expect(rankVaultSearchCandidates(candidates, "", 5).map((item) => item.kind)).toEqual([
      "trade", "instrument", "strategy", "playbook", "note",
    ]);
  });

  it("strips internal searchable text and preserves currency-isolated record metadata", () => {
    const results = rankVaultSearchCandidates(candidates, "reliance");
    expect(results).toHaveLength(2);
    expect(results[0]).not.toHaveProperty("searchText");
    expect(results.map((item) => item.currency)).toEqual(["INR", "INR"]);
    expect(results.find((item) => item.kind === "trade")?.amount).toBe(4200);
  });
});
