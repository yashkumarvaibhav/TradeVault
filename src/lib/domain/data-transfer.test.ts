import { describe, expect, it } from "vitest";

import { noteImportSignature, parseTradeVaultImport, tradeImportSignature } from "./data-transfer";

const legacy = {
  format: "tradevault_export_v3",
  exported_at: "2026-06-20T12:00:00Z",
  username: "must-not-be-trusted",
  trades: [{
    instrument: "nifty",
    asset_category: "Index",
    instrument_type: "Futures",
    direction: "Long",
    status: "closed",
    currency: "INR",
    entry_datetime: "2026-06-20T09:15",
    entry_price: 25_000,
    exit_datetime: "2026-06-20T10:15",
    exit_price: 25_100,
    position_size: 2,
    lot_size: 50,
    stop_loss: 24_900,
    planned_target: 25_300,
    strategy: "Opening range",
    playbook_name: "Index momentum",
    close_reason: "Target",
    mistake_tags: "Late entry, FOMO, Late entry",
    rule_followed: false,
  }],
  instruments: [],
  strategies: [{ name: "Opening range", description: "First-hour breakout" }],
  close_reasons: [{ reason: "Target" }],
  playbooks: [{ name: "Index momentum", market_scope: "NSE", setup_rules: ["Wait for range"] }],
};

describe("TradeVault import contract", () => {
  it("normalizes the v1-shaped v3 format and interprets legacy wall time in the user zone", () => {
    const result = parseTradeVaultImport(legacy, "Asia/Kolkata");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.trades[0]).toMatchObject({
      symbol: "NIFTY",
      entryAt: "2026-06-20T03:45:00.000Z",
      exitAt: "2026-06-20T04:45:00.000Z",
      multiplier: 50,
      strategyName: "Opening range",
      playbookName: "Index momentum",
      closeReasonName: "Target",
      tags: ["Late entry", "FOMO"],
      ruleViolations: "Imported legacy review marked rules not followed.",
    });
    expect(result.value.closeReasons).toEqual([{ name: "Target", description: null }]);
  });

  it("accepts current safe extensions without accepting identity or storage fields into the model", () => {
    const result = parseTradeVaultImport({
      ...legacy,
      username: "someone",
      password: "bad",
      storage_key: "/secret/path",
      trades: [{ ...legacy.trades[0], export_ref: "trade-1", fees: 20, fx_to_account: 1, setup_checklist: [{ id: "a", label: "Risk sized", phase: "entry", completed: true }] }],
      notes: [{ export_ref: "note-1", title: "Review", body_text: "Patient entry", note_type: "post-trade", collection: "setups", linked_trade_ref: "trade-1" }],
    }, "Asia/Kolkata");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty("username");
    expect(result.value).not.toHaveProperty("password");
    expect(result.value).not.toHaveProperty("storage_key");
    expect(result.value.trades[0].setupChecklist).toEqual([{ id: "a", label: "Risk sized", phase: "entry", completed: true }]);
    expect(result.value.notes[0]).toMatchObject({ title: "Review", linkedTradeRef: "trade-1", noteType: "post-trade" });
  });

  it("fails the entire payload before mutation when any trade is invalid", () => {
    const result = parseTradeVaultImport({ ...legacy, trades: [...legacy.trades, { instrument: "", entry_datetime: "yesterday", entry_price: "free", position_size: 0 }] }, "UTC");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/trades\[1\].*(instrument|symbol)/i);
    expect(result.errors.join(" ")).toMatch(/entry date/i);
  });

  it("rejects unsupported formats, oversized arrays, and closed trades without results", () => {
    expect(parseTradeVaultImport({ format: "unknown", trades: [] }, "UTC")).toMatchObject({ ok: false });
    const result = parseTradeVaultImport({ ...legacy, trades: [{ ...legacy.trades[0], exit_datetime: null, exit_price: null }] }, "UTC");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/closed trades need an exit date/i);
  });

  it("uses stable signatures for idempotent trade and note imports", () => {
    const result = parseTradeVaultImport({ ...legacy, notes: [{ title: "Review", body_text: "Text" }] }, "Asia/Kolkata");
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const trade = result.value.trades[0];
    expect(tradeImportSignature(trade)).toBe(tradeImportSignature({ ...trade, symbol: " nifty ", entryPrice: 25000.0 }));
    const note = result.value.notes[0];
    expect(noteImportSignature(note)).toBe(noteImportSignature({ ...note, title: " review " }));
  });
});
