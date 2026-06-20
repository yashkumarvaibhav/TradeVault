import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CalendarDashboard, type CalendarMode } from "@/components/calendar/calendar-dashboard";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildCalendarData } from "@/lib/calendar-data";
import { addDateKeyDays, dateKeyInTimeZone, isDateKey } from "@/lib/date-time";
import { requireWorkspaceSession } from "@/lib/workspace-session";
import { ASSET_OPTIONS, type ScopeAsset } from "@/lib/trade-scope";
import type { Currency } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar · TradeVault",
  description: "Currency-safe daily trading outcomes, reviews, and activity detail.",
};

function validMonth(value: string | undefined, fallback: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}

function validYear(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200 ? parsed : fallback;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mode?: string; month?: string; year?: string; day?: string; from?: string; to?: string; asset?: string; currency?: string }> }) {
  const { shellUser, scope, account, timeZone } = await requireWorkspaceSession();
  const rows = await createTradeRepository(getDb(), scope).listAll(account.id);
  const now = new Date();
  const query = await searchParams;
  const today = dateKeyInTimeZone(now, timeZone);
  const currentMonth = today.slice(0, 7);
  const mode = (["recent", "month", "year", "custom"].includes(query.mode ?? "") ? query.mode : "month") as CalendarMode;
  const month = validMonth(query.month, currentMonth);
  const year = validYear(query.year, Number(month.slice(0, 4)));
  const day = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) ? query.day : undefined;
  const customFrom = isDateKey(query.from) ? query.from : addDateKeyDays(today, -29);
  const customTo = isDateKey(query.to) ? query.to : today;
  const rangeError = mode === "custom" && query.from && query.to && customFrom > customTo ? "From must be on or before To." : undefined;
  const initialAsset = (ASSET_OPTIONS.includes(query.asset as ScopeAsset) ? query.asset : "Overall") as ScopeAsset;
  const initialCurrency = (query.currency === "USD" ? "USD" : "INR") as Currency;

  return <AppShell user={shellUser}><CalendarDashboard dataByAsset={buildCalendarData(rows, timeZone)} nowIso={now.toISOString()} initialMode={mode} initialMonth={month} initialYear={year} initialDay={day} initialFrom={customFrom} initialTo={customTo} initialAsset={initialAsset} initialCurrency={initialCurrency} rangeError={rangeError} timeZone={timeZone} /></AppShell>;
}
