import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/chip";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import { TradeEntryForm } from "./trade-entry-form";

export const dynamic = "force-dynamic";

export default async function AddTradePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { shellUser, scope } = await requireWorkspaceSession();
  await ensureDefaultTradeLibraries(getDb(), scope);
  const libraries = await getTradeEntryLibraries(getDb(), scope);
  const { saved } = await searchParams;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const initialEntryAt = now.toISOString().slice(0, 16);
  return <AppShell user={shellUser}><PageHeader eyebrow={<Chip tone="accent">P2 · Trade entry</Chip>} title="Add trade" description="Capture the position quickly, with risk feedback before you commit." /><div className="mt-8"><TradeEntryForm initialEntryAt={initialEntryAt} libraries={libraries} saved={saved === "1"} /></div></AppShell>;
}
