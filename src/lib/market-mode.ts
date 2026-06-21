import type { Currency } from "@/lib/domain/types";

export const MARKET_CURRENCY_COOKIE = "tradevault_market_currency";

export function parseMarketCurrency(value: string | undefined, fallback: Currency = "INR"): Currency {
  return value === "INR" || value === "USD" ? value : fallback;
}

export function otherMarketCurrency(currency: Currency): Currency {
  return currency === "INR" ? "USD" : "INR";
}

export function marketWorkspaceName(currency: Currency): string {
  return currency === "INR" ? "Indian / INR trades" : "International / USD trades";
}

export function marketSwitchLabel(currency: Currency): string {
  return currency === "INR" ? "Switch to International/USD Trades" : "Switch to Indian/INR Trades";
}
