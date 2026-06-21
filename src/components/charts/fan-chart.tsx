"use client";

import * as React from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { scaleLinear } from "@visx/scale";

import type { RiskSimBandPoint } from "@/lib/domain/risk-sim";

const width = 760;
const height = 320;
const margin = { top: 16, right: 20, bottom: 36, left: 52 };

function multiple(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 2)}×`;
}

/**
 * Monte-Carlo equity fan: a pale p5–p95 band, a stronger p25–p75 band, and a thick
 * median line, all anchored at the starting capital (1.0×). Drawn from the seeded
 * engine's `fan` output, so it is reproducible and never reflows.
 */
export function FanChart({
  fan,
  ruinThreshold,
  currency,
  horizon,
}: {
  fan: RiskSimBandPoint[];
  ruinThreshold: number;
  currency: string;
  horizon: number;
}) {
  const id = React.useId();
  if (fan.length === 0) return null;

  // Anchor every band at step 0 / equity 1.0 (the starting capital).
  const steps = [0, ...fan.map((point) => point.step)];
  const series = (p: number) => [1, ...fan.map((point) => point.percentiles[p] ?? 1)];
  const p5 = series(5);
  const p25 = series(25);
  const p50 = series(50);
  const p75 = series(75);
  const p95 = series(95);
  const ruinFloor = 1 - ruinThreshold;

  const lows = Math.min(ruinFloor, ...p5);
  const highs = Math.max(...p95);
  const pad = Math.max((highs - lows) * 0.08, 0.02);

  const xScale = scaleLinear({ domain: [0, horizon], range: [margin.left, width - margin.right] });
  const yScale = scaleLinear({ domain: [lows - pad, highs + pad], range: [height - margin.bottom, margin.top], nice: true });

  const point = (s: number, v: number) => `${xScale(s).toFixed(2)},${yScale(v).toFixed(2)}`;
  const band = (low: number[], high: number[]) => {
    const top = high.map((v, i) => point(steps[i], v));
    const bottom = low.map((v, i) => point(steps[i], v)).reverse();
    return `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`;
  };
  const line = (vals: number[]) => `M ${vals.map((v, i) => point(steps[i], v)).join(" L ")}`;

  const finalMedian = p50[p50.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-t ${id}-d`}>
        <title id={`${id}-t`}>Monte Carlo equity fan in {currency}</title>
        <desc id={`${id}-d`}>
          Percentile band of {fan.length} checkpoints across simulated {horizon}-trade futures, anchored at the starting capital. Median ends at {multiple(finalMedian)}. Historical scenario, not a forecast.
        </desc>

        <AxisLeft
          scale={yScale}
          left={margin.left}
          numTicks={5}
          tickFormat={(value) => multiple(Number(value))}
          stroke="var(--line)"
          tickStroke="var(--line)"
          tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "end", dx: -6, dy: 4 })}
        />

        {/* p5–p95 outer band, then p25–p75 inner band */}
        <path d={band(p5, p95)} fill="var(--accent)" opacity={0.12} />
        <path d={band(p25, p75)} fill="var(--accent)" opacity={0.22} />

        {/* starting capital + ruin floor reference lines */}
        <line x1={margin.left} x2={width - margin.right} y1={yScale(1)} y2={yScale(1)} stroke="var(--muted)" strokeDasharray="4 5" strokeWidth={1} />
        <line x1={margin.left} x2={width - margin.right} y1={yScale(ruinFloor)} y2={yScale(ruinFloor)} stroke="var(--loss)" strokeDasharray="3 4" strokeWidth={1} opacity={0.7} />

        {/* median path */}
        <path d={line(p50)} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" />

        <AxisBottom
          top={height - margin.bottom}
          scale={xScale}
          numTicks={6}
          tickFormat={(value) => `${Math.round(Number(value))}`}
          stroke="var(--line)"
          tickStroke="var(--line)"
          tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "middle", dy: 4 })}
        />
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span><span className="inline-block size-2 rounded-full bg-accent align-middle" aria-hidden="true" /> Median · pale band = 5th–95th, inner = 25th–75th percentile</span>
        <span>Dashed lines: starting capital and the {(ruinThreshold * 100).toFixed(0)}% ruin floor · trades on the x-axis</span>
      </figcaption>
    </figure>
  );
}
