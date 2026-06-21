import type { Currency } from "@/lib/domain/types";

/**
 * Compact money for chart axes and bar labels, e.g. ₹1.2L / -₹12K / $1.2M.
 * INR uses the Indian lakh/crore grouping (en-IN); USD uses K/M (en-US). Keeping
 * axis ticks compact lets every money chart show its actual scale without the
 * labels colliding — a curve or bar with no money scale is meaningless.
 */
export function compactMoneyFormatter(currency: Currency): Intl.NumberFormat {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

/** Narrow a free-form unit string (charts pass the currency code) to a Currency. */
export function currencyFromUnit(unit: string): Currency | null {
  return unit === "INR" || unit === "USD" ? unit : null;
}
