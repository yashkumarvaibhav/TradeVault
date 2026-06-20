import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CalendarDashboard, type CalendarMode } from "@/components/calendar/calendar-dashboard";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildCalendarData } from "@/lib/calendar-data";
import { requireWorkspaceSession } from "@/lib/workspace-session";

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

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mode?: string; month?: string; year?: string; day?: string }> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const rows = await createTradeRepository(getDb(), scope).listAll(account.id);
  const now = new Date();
  const query = await searchParams;
  const currentMonth = now.toISOString().slice(0, 7);
  const mode = (["recent", "month", "year"].includes(query.mode ?? "") ? query.mode : "month") as CalendarMode;
  const month = validMonth(query.month, currentMonth);
  const year = validYear(query.year, Number(month.slice(0, 4)));
  const day = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) ? query.day : undefined;

  return <AppShell user={shellUser}><CalendarDashboard dataByAsset={buildCalendarData(rows)} nowIso={now.toISOString()} initialMode={mode} initialMonth={month} initialYear={year} initialDay={day} /></AppShell>;
}
