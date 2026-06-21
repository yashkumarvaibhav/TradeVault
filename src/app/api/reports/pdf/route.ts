import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildAnalyticsByCurrency } from "@/lib/analytics-data";
import { formatDateInTimeZone } from "@/lib/date-time";
import type { Currency } from "@/lib/domain/types";
import { buildReportModel } from "@/lib/report-model";
import { parseTradeScope, scopePeriodLabel, scopeTradeRows } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";
import { renderReportPdf } from "@/server/pdf/render-report";

// react-pdf reads vendored fonts/brand art from disk and bundles fontkit, so this
// route must run on the Node.js runtime, never the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

export async function GET(request: Request) {
  // Fails closed: an unauthenticated request is redirected to /login by the session guard.
  const { scope: tenantScope, account, timeZone } = await requireWorkspaceSession();

  const url = new URL(request.url);
  const reportScope = parseTradeScope({
    period: url.searchParams.get("period") ?? undefined,
    asset: url.searchParams.get("asset") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const db = getDb();
  await ensureDefaultTradeLibraries(db, tenantScope);
  const [rows, libraries] = await Promise.all([
    createTradeRepository(db, tenantScope).listAll(account.id),
    getTradeEntryLibraries(db, tenantScope),
  ]);
  const scopedRows = scopeTradeRows(rows, reportScope, new Date(), timeZone);
  const analyticsByCurrency = buildAnalyticsByCurrency(
    scopedRows,
    new Map(libraries.strategies.map((item) => [item.id, item.name])),
    new Map(libraries.playbooks.map((item) => [item.id, item.name])),
    timeZone,
  );

  // One currency per document — INR and USD are never combined. Honour the requested
  // currency, else fall back to whichever currency actually has closed trades in scope.
  const requested = url.searchParams.get("currency");
  const candidates: Currency[] = [
    ...(requested === "INR" || requested === "USD" ? [requested as Currency] : []),
    account.defaultCurrency,
    "INR",
    "USD",
  ];
  const analytics = candidates.map((currency) => analyticsByCurrency[currency]).find(Boolean);

  if (!analytics) {
    return Response.json(
      { error: "No closed trades in this scope to build a report." },
      { status: 422 },
    );
  }

  const model = buildReportModel({
    analytics,
    accountName: account.name,
    periodLabel: scopePeriodLabel(reportScope),
    assetLabel: reportScope.asset,
    generatedLabel: formatDateInTimeZone(new Date(), timeZone, { dateStyle: "medium", timeStyle: "short" }),
  });

  const pdf = await renderReportPdf(model);
  const filename = `tradevault-${slugify(account.name)}-${analytics.currency.toLowerCase()}-${reportScope.period}.pdf`;

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(pdf.length),
    },
  });
}
