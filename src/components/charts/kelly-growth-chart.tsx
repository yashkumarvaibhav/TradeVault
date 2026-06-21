"use client";

import * as React from "react";
import { scaleLinear } from "@visx/scale";

const width = 760;
const height = 220;
const margin = { top: 14, right: 18, bottom: 34, left: 52 };

/**
 * Log-growth per trade vs risk fraction. The curve rises to the growth-optimal
 * fraction then falls — the visual "over-betting cliff". Vertical markers show
 * quarter / half / full Kelly so a trader can see why fractional Kelly is safer.
 */
export function KellyGrowthChart({
  growthCurve,
  quarterKelly,
  halfKelly,
  kellyFraction,
  growthOptimalFraction,
}: {
  growthCurve: { fraction: number; growth: number }[];
  quarterKelly: number;
  halfKelly: number;
  kellyFraction: number;
  growthOptimalFraction: number;
}) {
  const id = React.useId();
  const points = growthCurve.filter((p) => Number.isFinite(p.growth));
  if (points.length < 2) return null;

  const fractions = points.map((p) => p.fraction);
  const growths = points.map((p) => p.growth);
  const xMax = Math.max(...fractions, kellyFraction);
  const yLo = Math.min(0, ...growths);
  const yHi = Math.max(...growths);
  const yPad = Math.max((yHi - yLo) * 0.1, 0.001);

  const xScale = scaleLinear({ domain: [0, xMax], range: [margin.left, width - margin.right] });
  const yScale = scaleLinear({ domain: [yLo - yPad, yHi + yPad], range: [height - margin.bottom, margin.top], nice: true });

  const linePath = `M ${points.map((p) => `${xScale(p.fraction).toFixed(2)},${yScale(p.growth).toFixed(2)}`).join(" L ")}`;
  const marker = (fraction: number, label: string, strong: boolean) => {
    if (fraction <= 0 || fraction > xMax) return null;
    const x = xScale(fraction);
    return (
      <g key={label}>
        <line x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} stroke={strong ? "var(--accent)" : "var(--line)"} strokeDasharray="3 4" strokeWidth={strong ? 1.2 : 1} />
        <text x={x} y={margin.top + 9} textAnchor="middle" fontSize={9} fill={strong ? "var(--accent)" : "var(--muted)"}>{label}</text>
      </g>
    );
  };

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-t ${id}-d`}>
        <title id={`${id}-t`}>Expected log-growth per trade by risk fraction</title>
        <desc id={`${id}-d`}>Growth peaks at the optimal fraction {(growthOptimalFraction * 100).toFixed(1)}% and falls beyond it. Markers show quarter, half, and full Kelly. Historical scenario, not a forecast.</desc>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = yScale.domain()[0] + t * (yScale.domain()[1] - yScale.domain()[0]);
          return <line key={t} x1={margin.left} x2={width - margin.right} y1={yScale(v)} y2={yScale(v)} stroke="var(--line)" strokeWidth={0.5} />;
        })}
        <line x1={margin.left} x2={width - margin.right} y1={yScale(0)} y2={yScale(0)} stroke="var(--muted)" strokeDasharray="4 5" strokeWidth={1} />

        {marker(quarterKelly, "¼", false)}
        {marker(halfKelly, "½", false)}
        {marker(kellyFraction, "Full Kelly", true)}

        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" />

        {/* x ticks as percentages */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const f = t * xMax;
          return <text key={t} x={xScale(f)} y={height - margin.bottom + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">{(f * 100).toFixed(0)}%</text>;
        })}
        {[yScale.domain()[0], 0, yScale.domain()[1]].map((v, i) => (
          <text key={i} x={margin.left - 6} y={yScale(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{v.toFixed(3)}</text>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs text-muted">Expected log-growth per trade (y) by fraction of capital risked (x). Betting past full Kelly lowers growth and raises ruin.</figcaption>
    </figure>
  );
}
