import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/chip";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import { TradeEntryForm } from "../../new/trade-entry-form";
import { updateTradeAction } from "./actions";

export const dynamic = "force-dynamic";

/** Convert a stored UTC instant to a datetime-local value, symmetric with how Add Trade seeds it. */
function toLocalInput(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}
const num = (value: string | null) => (value == null ? "" : String(Number(value)));

export default async function EditTradePage({ params }: { params: Promise<{ tradeId: string }> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const { tradeId } = await params;
  const db = getDb();
  const trade = await createTradeRepository(db, scope).getById(account.id, tradeId);
  if (!trade) notFound();
  await ensureDefaultTradeLibraries(db, scope);
  const libraries = await getTradeEntryLibraries(db, scope);
  const entryAt = toLocalInput(trade.entryAt);

  return (
    <AppShell user={shellUser}>
      <Link href={`/trades/${trade.id}`} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm font-semibold text-muted hover:bg-hover hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />Back to trade
      </Link>
      <PageHeader eyebrow={<Chip tone="accent">P4 · Edit trade</Chip>} title={`Edit ${trade.symbol}`} description="Change any detail. Risk, R, and realized P&L recompute from the same tested engine." />
      <div className="mt-8">
        <TradeEntryForm
          mode="edit"
          action={updateTradeAction}
          initialEntryAt={entryAt}
          libraries={libraries}
          cancelHref={`/trades/${trade.id}`}
          hiddenFields={{ tradeId: trade.id }}
          initialValues={{
            symbol: trade.symbol,
            assetClass: trade.assetClass,
            instrumentType: trade.instrumentType,
            direction: trade.direction,
            status: trade.status,
            currency: trade.currency,
            entryAt,
            entryPrice: num(trade.entryPrice),
            exitAt: trade.exitAt ? toLocalInput(trade.exitAt) : "",
            exitPrice: num(trade.exitPrice),
            quantity: num(trade.quantity),
            multiplier: num(trade.multiplier),
            stopLoss: num(trade.stopLoss),
            plannedTarget: num(trade.plannedTarget),
            manualPnl: num(trade.manualPnl),
            fees: num(trade.fees),
            fxToAccount: num(trade.fxToAccount),
            confidence: trade.confidence == null ? "" : String(trade.confidence),
            emotion: trade.emotion ?? "",
            subcategory: trade.subcategory ?? "",
            tradingStyle: trade.tradingStyle ?? "",
            platform: trade.platform ?? "",
            strategyId: trade.strategyId ?? "",
            playbookId: trade.playbookId ?? "",
            closeReasonId: trade.closeReasonId ?? "",
          }}
          initialChecklist={trade.setupChecklist}
          initialText={{
            tags: trade.tags.join(", "),
            ruleViolations: trade.ruleViolations ?? "",
            linkedNote: trade.linkedNote ?? "",
            notes: trade.notes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
