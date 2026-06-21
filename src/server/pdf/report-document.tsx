import "server-only";

import * as React from "react";
import {
  Circle,
  Document,
  Line,
  Page,
  Path,
  Polyline,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Currency } from "@/lib/domain/types";
import { formatReportMoneyCompact, type ReportChartPoint, type ReportModel, type ReportSymbolBar } from "@/lib/report-model";

import { registerReportFonts, SANS } from "./assets";

/** Round "nice" axis ticks + bounds so a money chart reads in clean increments. */
function niceAxis(min: number, max: number, count = 4): { ticks: number[]; lo: number; hi: number } {
  const lo0 = Math.min(0, min);
  let hi0 = Math.max(0, max);
  if (lo0 === hi0) hi0 = lo0 + 1;
  const step0 = (hi0 - lo0) / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(lo0 / step) * step;
  const hi = Math.ceil(hi0 / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(Math.round(v));
  return { ticks, lo, hi };
}

/** Editorial light palette, locked — the PDF never follows the viewer's theme. */
const C = {
  accent: "#3fada8",
  accentSoft: "#eaf5f4",
  ink: "#333333",
  body: "#4d4d4d",
  muted: "#666666",
  faint: "#808080",
  line: "#e4e4e4",
  lineStrong: "#cfe6e4",
  page: "#ffffff",
  soft: "#f5f6f6",
  profit: "#2f9e6f",
  loss: "#c0392b",
} as const;

const SERIF = registerReportFonts();

function toneColor(tone: "profit" | "loss" | "neutral"): string {
  if (tone === "profit") return C.profit;
  if (tone === "loss") return C.loss;
  return C.ink;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 54,
    paddingHorizontal: 40,
    fontFamily: SANS,
    fontSize: 9,
    color: C.body,
    backgroundColor: C.page,
  },
  // The watermark is a faint, centered vector of the brand mark. Drawn (not
  // raster-embedded) so it renders identically in every PDF viewer.
  watermark: {
    position: "absolute",
    top: 318,
    left: 172,
    width: 250,
    height: 250,
    opacity: 0.55,
  },
  header: {
    position: "absolute",
    top: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerWordmarkText: { fontFamily: SERIF, fontWeight: 600, fontSize: 17, color: C.ink },
  headerRight: { textAlign: "right" },
  headerKicker: { fontSize: 7.5, letterSpacing: 1.4, color: C.accent, fontFamily: SANS },
  headerTitle: { fontSize: 10, color: C.ink, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.line,
    fontSize: 7.5,
    color: C.faint,
  },
  titleBlock: { marginBottom: 16 },
  eyebrow: { fontSize: 8, letterSpacing: 1.6, color: C.accent, fontFamily: SANS, textTransform: "uppercase" },
  title: { fontFamily: SERIF, fontWeight: 500, fontSize: 26, color: C.ink, marginTop: 6 },
  subtitle: { fontSize: 10, color: C.muted, marginTop: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  chip: {
    fontSize: 8,
    color: C.accent,
    backgroundColor: C.accentSoft,
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  metaText: { fontSize: 8.5, color: C.faint, textAlign: "right" },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 10,
    backgroundColor: C.page,
  },
  kpiLabel: { fontSize: 7, letterSpacing: 0.8, color: C.muted, textTransform: "uppercase" },
  // Money/metrics stay in the sans (the "Arial" of the identity); the serif is
  // reserved for editorial prose headings, and it lacks the ₹/Rs idiom anyway.
  kpiValue: { fontFamily: SANS, fontWeight: 700, fontSize: 16, marginTop: 6, color: C.ink },
  kpiDetail: { fontSize: 7.5, color: C.faint, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: SERIF, fontWeight: 500, fontSize: 14, color: C.ink },
  sectionNote: { fontSize: 8, color: C.faint, marginTop: 2, marginBottom: 8 },
  twoCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  riskGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  riskCell: {
    width: "47%",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: C.soft,
  },
  riskLabel: { fontSize: 7, letterSpacing: 0.6, color: C.muted, textTransform: "uppercase" },
  riskValue: { fontSize: 10.5, color: C.ink, marginTop: 3, fontFamily: SANS },
  symbolRow: { marginBottom: 8 },
  symbolHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  symbolName: { fontSize: 9, color: C.ink },
  symbolMeta: { fontSize: 8, color: C.muted },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: C.soft, overflow: "hidden" },
  isolation: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.5,
  },
  axisRow: { flexDirection: "row", marginTop: 4 },
  axisLabel: { fontSize: 6.5, color: C.faint, textAlign: "center" },
  emptyChart: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 8, color: C.faint },
});

/**
 * The TradeVault brand mark, drawn as vectors: a rounded teal vault square with an
 * upward trend line and a marked peak (the "growth chart" motif of the logo). Drawn
 * rather than raster-embedded so it is identical in every viewer and verifiable.
 */
function BrandMark({ size, color = C.accent, stroke = 1.8 }: { size: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={1.5} y={1.5} width={21} height={21} rx={5.5} stroke={color} strokeWidth={stroke} fill="none" />
      <Polyline
        points="5,16.5 9.5,11.5 13,14.5 19,6.5"
        fill="none"
        stroke={color}
        strokeWidth={stroke + 0.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={19} cy={6.5} r={stroke} fill={color} />
    </Svg>
  );
}

function PageFrame({ model }: { model: ReportModel }) {
  return (
    <>
      <View style={styles.watermark} fixed>
        <BrandMark size={250} stroke={1.1} color="#dce5e4" />
      </View>
      <View style={styles.header} fixed>
        <View style={styles.headerBrand}>
          <BrandMark size={22} />
          <Text style={styles.headerWordmarkText}>TradeVault</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerKicker}>PERFORMANCE REPORT</Text>
          <Text style={styles.headerTitle}>
            {model.accountName} · {model.currency}
          </Text>
        </View>
      </View>
      <View style={styles.footer} fixed>
        <Text>TradeVault · {model.currency} only · not financial advice</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

const AXIS_W = 52;

/** Money Y-axis: light gridlines + right-aligned compact labels (e.g. "Rs 1.2L"). */
function MoneyAxis({ ticks, y, plotLeft, plotRight, currency }: { ticks: number[]; y: (v: number) => number; plotLeft: number; plotRight: number; currency: Currency }) {
  return (
    <>
      {ticks.map((t) => (
        <React.Fragment key={t}>
          <Line x1={plotLeft} y1={y(t)} x2={plotRight} y2={y(t)} stroke={t === 0 ? C.muted : C.line} strokeWidth={t === 0 ? 0.6 : 0.4} />
          <Text x={plotLeft - 4} y={y(t) + 2.2} textAnchor="end" fill={C.faint} style={{ fontFamily: SANS, fontSize: 6.2 }}>
            {formatReportMoneyCompact(currency, t)}
          </Text>
        </React.Fragment>
      ))}
    </>
  );
}

/** Deterministic equity line chart with a money Y-axis. Never reflows or overflows. */
function LineChartSvg({ points, width, height, currency }: { points: ReportChartPoint[]; width: number; height: number; currency: Currency }) {
  if (points.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>Not enough closed trades to plot a curve.</Text>
      </View>
    );
  }
  const values = points.map((p) => p.value);
  const { ticks, lo, hi } = niceAxis(Math.min(...values), Math.max(...values));
  const range = hi - lo || 1;
  const n = points.length;
  const plotLeft = AXIS_W;
  const plotW = width - plotLeft;
  const x = (i: number) => plotLeft + (i / (n - 1)) * plotW;
  const y = (v: number) => height - ((v - lo) / range) * height;
  const zeroY = y(0);
  const coords = points.map((p, i) => `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`);
  const area = `M ${x(0).toFixed(2)},${zeroY.toFixed(2)} L ${coords.join(" L ")} L ${x(n - 1).toFixed(2)},${zeroY.toFixed(2)} Z`;
  return (
    <Svg width={width} height={height}>
      <MoneyAxis ticks={ticks} y={y} plotLeft={plotLeft} plotRight={width} currency={currency} />
      <Path d={area} fill={C.accentSoft} />
      <Polyline points={coords.join(" ")} fill="none" stroke={C.accent} strokeWidth={1.4} />
    </Svg>
  );
}

/** Deterministic diverging bar chart (monthly / weekday P&L) with a money Y-axis. */
function BarChartSvg({ points, width, height, currency }: { points: ReportChartPoint[]; width: number; height: number; currency: Currency }) {
  if (points.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>No closed trades in this scope.</Text>
      </View>
    );
  }
  const values = points.map((p) => p.value);
  const { ticks, lo, hi } = niceAxis(Math.min(...values), Math.max(...values));
  const range = hi - lo || 1;
  const n = points.length;
  const plotLeft = AXIS_W;
  const plotW = width - plotLeft;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.6, 24);
  const y = (v: number) => height - ((v - lo) / range) * height;
  const zeroY = y(0);
  const showLabels = n <= 7;
  return (
    <Svg width={width} height={height}>
      <MoneyAxis ticks={ticks} y={y} plotLeft={plotLeft} plotRight={width} currency={currency} />
      {points.map((p, i) => {
        const cx = plotLeft + slot * i + slot / 2;
        const top = Math.min(zeroY, y(p.value));
        const h = Math.max(1, Math.abs(y(p.value) - zeroY));
        return (
          <React.Fragment key={`${p.label}-${i}`}>
            <Rect x={cx - barW / 2} y={top} width={barW} height={h} fill={p.value >= 0 ? C.profit : C.loss} rx={1.5} />
            {showLabels ? (
              <Text x={cx} y={p.value >= 0 ? top - 3 : top + h + 6} textAnchor="middle" fill={p.value >= 0 ? C.profit : C.loss} style={{ fontFamily: SANS, fontSize: 6 }}>
                {formatReportMoneyCompact(currency, p.value)}
              </Text>
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function BarAxis({ points }: { points: ReportChartPoint[] }) {
  if (points.length === 0) return null;
  return (
    <View style={[styles.axisRow, { paddingLeft: AXIS_W }]}>
      {points.map((p, i) => (
        <Text key={`${p.label}-${i}`} style={[styles.axisLabel, { flex: 1 }]}>
          {p.label}
        </Text>
      ))}
    </View>
  );
}

function SymbolBars({ rows }: { rows: ReportSymbolBar[] }) {
  if (rows.length === 0) {
    return <Text style={styles.emptyText}>No ranked symbols in this scope.</Text>;
  }
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  return (
    <View>
      {rows.map((row) => (
        <View key={row.symbol} style={styles.symbolRow}>
          <View style={styles.symbolHead}>
            <Text style={styles.symbolName}>{row.symbol}</Text>
            <Text style={{ fontSize: 9, color: row.pnl >= 0 ? C.profit : C.loss }}>{row.pnlLabel}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={{
                height: 5,
                borderRadius: 3,
                width: `${(Math.abs(row.pnl) / maxAbs) * 100}%`,
                backgroundColor: row.pnl >= 0 ? C.profit : C.loss,
              }}
            />
          </View>
          <Text style={[styles.symbolMeta, { marginTop: 2 }]}>
            {row.count} trades · {row.winPctLabel} win
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ model }: { model: ReportModel }) {
  const chartWidth = 515;
  const halfWidth = 245;
  return (
    <Document title={`TradeVault report — ${model.accountName} (${model.currency})`} author="TradeVault">
      <Page size="A4" style={styles.page} wrap>
        <PageFrame model={model} />

        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>TradeVault performance report</Text>
          <Text style={styles.title}>{model.accountName}</Text>
          <Text style={styles.subtitle}>
            {model.periodLabel} · {model.assetLabel} · closed trades · {model.currency} only
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.chip}>{model.currency}</Text>
            <View>
              <Text style={styles.metaText}>Generated {model.generatedLabel}</Text>
              <Text style={styles.metaText}>{model.sampleNote}</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiRow} wrap={false}>
          {model.headline.map((kpi) => (
            <View key={kpi.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={[styles.kpiValue, { color: toneColor(kpi.tone) }]}>{kpi.value}</Text>
              <Text style={styles.kpiDetail}>{kpi.detail}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Equity curve</Text>
          <Text style={styles.sectionNote}>Cumulative closed-trade P&amp;L · {model.currency}</Text>
          <LineChartSvg points={model.equity} width={chartWidth} height={150} currency={model.currency} />
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.col, styles.section]} wrap={false}>
            <Text style={styles.sectionTitle}>Monthly P&amp;L</Text>
            <Text style={styles.sectionNote}>Closed trades · {model.currency}</Text>
            <BarChartSvg points={model.monthly} width={halfWidth} height={130} currency={model.currency} />
            <BarAxis points={model.monthly} />
          </View>
          <View style={[styles.col, styles.section]} wrap={false}>
            <Text style={styles.sectionTitle}>Weekday performance</Text>
            <Text style={styles.sectionNote}>Net P&amp;L by outcome day · {model.currency}</Text>
            <BarChartSvg points={model.weekday} width={halfWidth} height={130} currency={model.currency} />
            <BarAxis points={model.weekday} />
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.col, styles.section]} wrap={false}>
            <Text style={styles.sectionTitle}>Risk snapshot</Text>
            <Text style={styles.sectionNote}>{model.currency} · closed trades</Text>
            <View style={styles.riskGrid}>
              {model.riskRows.map((row) => (
                <View key={row.label} style={styles.riskCell}>
                  <Text style={styles.riskLabel}>{row.label}</Text>
                  <Text style={styles.riskValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.col, styles.section]} wrap={false}>
            <Text style={styles.sectionTitle}>Top symbols</Text>
            <Text style={styles.sectionNote}>Ranked by absolute P&amp;L · {model.currency}</Text>
            <SymbolBars rows={model.topSymbols} />
          </View>
        </View>

        <Text style={styles.isolation}>{model.isolationNote}</Text>
      </Page>
    </Document>
  );
}
