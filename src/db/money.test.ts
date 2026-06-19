import { describe, expect, expectTypeOf, it } from "vitest";

import type { Currency, Money } from "@/lib/domain/types";
import { moneyFromRow, moneyToRow, sumMoneyByCurrency, type StoredMoney } from "./money";

describe("database money boundary", () => {
  it("keeps amount and currency paired through storage conversion", () => {
    const stored = moneyToRow({ amount: 18420.75, currency: "INR" });
    expect(stored).toEqual({ amount: "18420.75", currency: "INR" });
    expect(moneyFromRow(stored)).toEqual({ amount: 18420.75, currency: "INR" });
    expectTypeOf(stored).toEqualTypeOf<StoredMoney>();
  });

  it("rejects unsupported currencies and non-finite values", () => {
    expect(() => moneyFromRow({ amount: "10", currency: "EUR" })).toThrow("Unsupported currency");
    expect(() => moneyFromRow({ amount: "NaN", currency: "USD" })).toThrow("Invalid monetary amount");
    expect(() => moneyToRow({ amount: Number.POSITIVE_INFINITY, currency: "USD" })).toThrow("finite");
  });

  it("can only aggregate into separately labelled currency totals", () => {
    const totals = sumMoneyByCurrency([
      { amount: 1000, currency: "INR" },
      { amount: -20, currency: "INR" },
      { amount: 50, currency: "USD" },
    ]);

    expect(totals).toEqual({
      INR: { amount: 980, currency: "INR" },
      USD: { amount: 50, currency: "USD" },
    });
    expectTypeOf(totals).toEqualTypeOf<Partial<Record<Currency, Money>>>();
  });
});
