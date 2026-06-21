import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/chip";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";
import { dateTimeLocalValue } from "@/lib/date-time";

import { TradeEntryForm } from "./trade-entry-form";

export const dynamic = "force-dynamic";

export default async function AddTradePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { shellUser, scope, timeZone } = await requireWorkspaceSession();
  await ensureDefaultTradeLibraries(getDb(), scope);
  const libraries = await getTradeEntryLibraries(getDb(), scope);
  const { saved } = await searchParams;
  const initialEntryAt = dateTimeLocalValue(new Date(), timeZone);
  return <AppShell user={shellUser}><PageHeader eyebrow={<Chip tone="accent">P2 · Trade entry</Chip>} title="Add trade" description="Capture the position quickly, with risk feedback before you commit." /><div className="mt-8"><TradeEntryForm key={shellUser.currency} initialEntryAt={initialEntryAt} initialCurrency={shellUser.currency} libraries={libraries} saved={saved === "1"} timeZone={timeZone} /></div></AppShell>;
}
