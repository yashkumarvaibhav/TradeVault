import { and, eq, inArray } from "drizzle-orm";

import { createDatabase } from "../src/db/client";
import type { Database } from "../src/db/client";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries, type TradeEntryLibraries } from "../src/db/repositories/libraries";
import { createNoteRepository } from "../src/db/repositories/notes";
import { createTradeRepository } from "../src/db/repositories/trades";
import { createTradingAccountRepository, ensureWorkspaceForUser, type TenantScope } from "../src/db/repositories/workspaces";
import { playbooks, trades, users } from "../src/db/schema";
import { evaluateExcursions } from "../src/lib/domain/excursions";
import type { AssetClass, Currency, InstrumentType } from "../src/lib/domain/types";

const markets: Array<{ symbol: string; assetClass: AssetClass; instrumentType: InstrumentType; currency: Currency; entry: number; multiplier: number }> = [
  { symbol: "RELIANCE", assetClass: "Equity", instrumentType: "Cash", currency: "INR", entry: 2920, multiplier: 1 },
  { symbol: "NIFTY", assetClass: "Index", instrumentType: "Futures", currency: "INR", entry: 24800, multiplier: 50 },
  { symbol: "BANKNIFTY", assetClass: "Index", instrumentType: "Options", currency: "INR", entry: 420, multiplier: 15 },
  { symbol: "GOLD", assetClass: "Commodity", instrumentType: "Futures", currency: "INR", entry: 72800, multiplier: 1 },
  { symbol: "EURUSD", assetClass: "Forex", instrumentType: "Cash", currency: "USD", entry: 1.09, multiplier: 1 },
  { symbol: "NASDAQ", assetClass: "US Index", instrumentType: "Futures", currency: "USD", entry: 19850, multiplier: 2 },
  { symbol: "AAPL", assetClass: "Equity", instrumentType: "Options", currency: "USD", entry: 5.4, multiplier: 100 },
  { symbol: "BTCUSD", assetClass: "Crypto", instrumentType: "Cash", currency: "USD", entry: 104000, multiplier: 1 },
  { symbol: "ETHUSD", assetClass: "Crypto", instrumentType: "Futures", currency: "USD", entry: 3550, multiplier: 1 },
];
const emotions = ["Focused", "Calm", "Confident", "Anxious", "FOMO", "Revenge"];
const styles = ["Intraday", "Swing", "Position"];
const numeric = (value: number | null) => value == null ? null : String(value);

function demoExtrema(direction: "Long" | "Short", status: "open" | "closed", entry: number, exit: number | null, stop: number | null, index: number) {
  if (status !== "closed" || exit == null) return { mfePrice: null, maePrice: null };
  const riskMove = stop == null ? entry * 0.01 : Math.abs(entry - stop);
  const favorablePadding = riskMove * (0.35 + index % 4 * 0.2);
  const adversePadding = riskMove * (0.15 + index % 3 * 0.1);
  return direction === "Long"
    ? { mfePrice: Math.max(entry, exit) + favorablePadding, maePrice: Math.max(Number.EPSILON, Math.min(entry, exit) - adversePadding) }
    : { mfePrice: Math.max(Number.EPSILON, Math.min(entry, exit) - favorablePadding), maePrice: Math.max(entry, exit) + adversePadding };
}

async function main() {
  const client = createDatabase();
  try {
    const [user] = await client.db.select().from(users).where(inArray(users.username, ["demo1", "yashdemo1"])).limit(1);
    if (!user) throw new Error("Demo user not found (expected demo1 or yashdemo1).");
    const scope = await ensureWorkspaceForUser(client.db, { userId: user.id, slugBase: user.username, tenantName: `${user.name}'s vault` });
    const account = await createTradingAccountRepository(client.db, scope).getDefault();
    if (!account) throw new Error("Demo account has no default trading account.");
    const repository = createTradeRepository(client.db, scope);
    await ensureDefaultTradeLibraries(client.db, scope);
    const libraries = await getTradeEntryLibraries(client.db, scope);
    const existing = (await repository.list({ accountId: account.id, limit: 100 })).filter((trade) => trade.tags.includes("demo-seed-v1"));
    if (existing.length) {
      await client.db.transaction(async (tx) => {
        for (const [index, trade] of existing.entries()) {
          const mfeMae = demoExtrema(trade.direction, trade.status, Number(trade.entryPrice), trade.exitPrice == null ? null : Number(trade.exitPrice), trade.stopLoss == null ? null : Number(trade.stopLoss), index);
          const excursion = evaluateExcursions({
            status: trade.status, direction: trade.direction, currency: trade.currency, entryPrice: Number(trade.entryPrice),
            stopLoss: trade.stopLoss == null ? null : Number(trade.stopLoss), plannedTarget: trade.plannedTarget == null ? null : Number(trade.plannedTarget),
            exitPrice: trade.exitPrice == null ? null : Number(trade.exitPrice), quantity: Number(trade.quantity), multiplier: Number(trade.multiplier),
            manualPnl: trade.manualPnl == null ? null : Number(trade.manualPnl), fxToAccount: Number(trade.fxToAccount), ...mfeMae,
          });
          await tx.update(trades).set({
            strategyId: libraries.strategies[index % libraries.strategies.length].id,
            playbookId: libraries.playbooks[index % libraries.playbooks.length].id,
            closeReasonId: trade.status === "closed" ? libraries.closeReasons[index % libraries.closeReasons.length].id : null,
            setupChecklist: libraries.checklistTemplates[0].items.map((item, itemIndex) => ({ ...item, completed: itemIndex < (trade.status === "closed" ? 5 : 3) })),
            mfePrice: numeric(mfeMae.mfePrice), maePrice: numeric(mfeMae.maePrice),
            mfeAmount: numeric(excursion.metrics.mfeAmount), maeAmount: numeric(excursion.metrics.maeAmount),
            mfeR: numeric(excursion.metrics.mfeR), maeR: numeric(excursion.metrics.maeR), capturedMovePct: numeric(excursion.metrics.capturedMovePct),
            updatedAt: new Date(),
          }).where(and(eq(trades.id, trade.id), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId)));
        }
      });
      console.log(`Demo seed enriched: ${existing.length} existing trades linked to libraries and synthetic manual excursion evidence.`);
    } else {
    const anchor = Date.UTC(2026, 5, 18, 9, 15);
    for (let index = 0; index < 72; index += 1) {
      const market = markets[index % markets.length];
      const direction = index % 3 === 0 ? "Short" as const : "Long" as const;
      const status = index % 7 === 0 ? "open" as const : "closed" as const;
      const scale = market.entry < 10 ? 0.01 : market.entry > 50_000 ? 0.008 : 0.02;
      const riskMove = market.entry * scale;
      const stopLoss = direction === "Long" ? market.entry - riskMove : market.entry + riskMove;
      const plannedTarget = direction === "Long" ? market.entry + riskMove * 2 : market.entry - riskMove * 2;
      const won = index % 4 !== 0;
      const exitPrice = status === "closed"
        ? direction === "Long" ? market.entry + riskMove * (won ? 1.4 : -0.8) : market.entry - riskMove * (won ? 1.4 : -0.8)
        : null;
      const entryAt = new Date(anchor - index * 5 * 24 * 60 * 60 * 1000);
      const exitAt = status === "closed" ? new Date(entryAt.getTime() + (2 + index % 72) * 60 * 60 * 1000) : null;
      const quantity = market.assetClass === "Forex" ? 10_000 : market.assetClass === "Crypto" ? 0.2 + (index % 4) * 0.1 : 1 + index % 8;
      const manualPnl = market.assetClass === "Forex" && status === "closed" && index % 2 === 0 ? (won ? 180 : -95) : null;
      const mfeMae = demoExtrema(direction, status, market.entry, exitPrice, stopLoss, index);

      await repository.create({
        accountId: account.id, symbol: market.symbol, assetClass: market.assetClass, instrumentType: market.instrumentType,
        direction, status, currency: market.currency, entryAt: entryAt.toISOString(), entryPrice: market.entry,
        exitAt: exitAt?.toISOString() ?? null, exitPrice, quantity, multiplier: market.multiplier, stopLoss, plannedTarget,
        manualPnl, fees: market.currency === "INR" ? 35 + index % 20 : 1.5 + index % 5, fxToAccount: 1, ...mfeMae,
        subcategory: market.assetClass === "Equity" ? "Large cap" : "Core market", tradingStyle: styles[index % styles.length],
        platform: market.currency === "INR" ? "Zerodha" : "Interactive Brokers", confidence: 1 + index % 5,
        emotion: emotions[index % emotions.length], tags: ["demo-seed-v1", won ? "clean-execution" : "review-needed"],
        ruleViolations: index % 9 === 0 ? "Entered before confirmation" : null,
        linkedNote: index % 5 === 0 ? "Opening-range thesis and invalidation documented before entry." : null,
        notes: won ? "Waited for confirmation and respected the initial stop." : "Review timing and position sizing before repeating this setup.",
        strategyId: libraries.strategies[index % libraries.strategies.length].id,
        playbookId: libraries.playbooks[index % libraries.playbooks.length].id,
        closeReasonId: status === "closed" ? libraries.closeReasons[index % libraries.closeReasons.length].id : null,
        setupChecklist: libraries.checklistTemplates[0].items.map((item, itemIndex) => ({ ...item, completed: itemIndex < (status === "closed" ? 5 : 3) })),
      });
    }
    console.log("Demo seed complete: 72 tenant-scoped trades across INR and USD, all asset classes, directions, and statuses.");
    }

    const recentForLinks = await repository.list({ accountId: account.id, limit: 6 });
    await seedDemoNotes(client.db, scope, account.id, libraries, recentForLinks.map((trade) => ({ id: trade.id, symbol: trade.symbol })));
  } finally {
    await client.pool.end();
  }
}

/** Plain text → a one-paragraph TipTap doc so seeded notes open richly in the editor. */
function paragraphDoc(text: string) {
  return { type: "doc" as const, content: text.split("\n").filter(Boolean).map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })) };
}

/** Idempotently seed a few varied dedicated notes + give two playbooks notes (so the
 *  playbook source path is visible). Skips entirely once dedicated notes already exist. */
async function seedDemoNotes(
  db: Database,
  scope: TenantScope,
  accountId: string,
  libraries: TradeEntryLibraries,
  recentTrades: Array<{ id: string; symbol: string }>,
) {
  const notesRepo = createNoteRepository(db, scope);
  if ((await notesRepo.listForFeed(accountId)).length > 0) {
    console.log("Demo notes already present — skipped.");
    return;
  }

  // Surface playbook source notes by giving the first two playbooks a note.
  const playbookNotes = [
    "Only take this setup with a defined opening range and volume confirmation. Skip thin, newsy sessions.",
    "Trail behind structure once price clears 1R; never widen the original stop.",
  ];
  for (const [index, playbook] of libraries.playbooks.slice(0, 2).entries()) {
    await db.update(playbooks).set({ notes: playbookNotes[index], updatedAt: new Date() }).where(and(eq(playbooks.id, playbook.id), eq(playbooks.tenantId, scope.tenantId)));
  }

  const linkTrade = recentTrades[0]?.id ?? null;
  const linkSymbol = recentTrades[0]?.symbol ?? "a trade";
  const seeds: Parameters<typeof notesRepo.create>[0][] = [
    {
      accountId, title: "Weekly intent — patience over frequency", pinned: true, noteType: "daily-journal", collection: "none",
      bodyText: "Theme this week: fewer, higher-quality trades.\nWait for A+ setups; one good trade beats three forced ones.\nReset after any loss before re-engaging.",
      bodyJson: paragraphDoc("Theme this week: fewer, higher-quality trades.\nWait for A+ setups; one good trade beats three forced ones.\nReset after any loss before re-engaging."),
    },
    {
      accountId, title: "My risk rules", noteType: "general", collection: "risk-rules",
      bodyText: "Max 1% account risk per trade.\nNo more than two correlated positions open at once.\nStop trading for the day after two consecutive rule violations.",
      bodyJson: paragraphDoc("Max 1% account risk per trade.\nNo more than two correlated positions open at once.\nStop trading for the day after two consecutive rule violations."),
    },
    {
      accountId, title: `Lesson from ${linkSymbol}`, noteType: "post-trade", collection: "mistakes", linkedTradeId: linkTrade,
      bodyText: "Chased the entry after the first leg already ran. Risk/reward was poor at that price. Next time: set an alert at the level and only act on a clean retest.",
      bodyJson: paragraphDoc("Chased the entry after the first leg already ran. Risk/reward was poor at that price. Next time: set an alert at the level and only act on a clean retest."),
    },
    {
      accountId, title: "Pre-trade plan (my template)", isTemplate: true, noteType: "pre-trade", collection: "setups",
      bodyText: "Thesis:\nSetup / trigger:\nInitial stop & invalidation:\nSize (within risk budget):\nTarget / reward-to-risk:",
      bodyJson: paragraphDoc("Thesis:\nSetup / trigger:\nInitial stop & invalidation:\nSize (within risk budget):\nTarget / reward-to-risk:"),
    },
  ];
  for (const seed of seeds) await notesRepo.create(seed);
  console.log(`Demo notes seeded: ${seeds.length} dedicated notes (pinned journal, risk rules, a linked lesson, a template) + 2 playbook notes.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
