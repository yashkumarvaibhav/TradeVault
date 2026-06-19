import type { Currency, Money } from "@/lib/domain/types";
import { sumMoney } from "@/lib/domain/pnl";
import { currencyCodes } from "@/db/schema";

export interface StoredMoney {
  amount: string;
  currency: Currency;
}

const validCurrencies = new Set<string>(currencyCodes);

export function moneyToRow(money: Money): StoredMoney {
  if (!Number.isFinite(money.amount)) throw new Error("Money amount must be finite.");
  return { amount: money.amount.toString(), currency: money.currency };
}

export function moneyFromRow(row: { amount: string; currency: string }): Money {
  if (!validCurrencies.has(row.currency)) throw new Error(`Unsupported currency: ${row.currency}`);
  const amount = Number(row.amount);
  if (!Number.isFinite(amount)) throw new Error(`Invalid monetary amount: ${row.amount}`);
  return { amount, currency: row.currency as Currency };
}

/**
 * The persistence boundary returns one total per currency and deliberately has
 * no API that produces a raw mixed-currency total.
 */
export function sumMoneyByCurrency(items: readonly Money[]): Partial<Record<Currency, Money>> {
  const grouped = new Map<Currency, Money[]>();
  for (const item of items) {
    const bucket = grouped.get(item.currency) ?? [];
    bucket.push(item);
    grouped.set(item.currency, bucket);
  }

  const totals: Partial<Record<Currency, Money>> = {};
  for (const currency of currencyCodes) {
    const bucket = grouped.get(currency);
    if (bucket?.length) totals[currency] = sumMoney(bucket);
  }
  return totals;
}
