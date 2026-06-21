"use client";

import * as React from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { scaleLinear } from "@visx/scale";

import { ChartStatePanel } from "@/components/charts/chart-state";
import type { ExcursionPoint } from "@/lib/domain/excursion-analytics";

const width = 760;
const height = 300;
const margin = { top: 18, right: 18, bottom: 50, left: 54 };

export function ExcursionChart({ points, currency }: { points: ExcursionPoint[]; currency: string }) {
  const id = React.useId();
  if (!points.length) return <ChartStatePanel state="empty" message="No manual favorable-excursion evidence in this scope." />;

  const maxValue = Math.max(1, ...points.flatMap((point) => [point.mfeR, point.realizedR]));
  const minRealized = Math.min(0, ...points.map((point) => point.realizedR));
  const padding = Math.max(maxValue * 0.08, 0.15);
  const xScale = scaleLinear({ domain: [0, maxValue + padding], range: [margin.left, width - margin.right], nice: true });
  const yScale = scaleLinear({ domain: [minRealized - (minRealized < 0 ? padding : 0), maxValue + padding], range: [height - margin.bottom, margin.top], nice: true });
  const diagonalEnd = Math.min(xScale.domain()[1], yScale.domain()[1]);

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{`${currency} favorable excursion captured versus realized R`}</title>
        <desc id={`${id}-desc`}>{`${points.length} manually captured trades. Horizontal axis is maximum favorable excursion in R; vertical axis is realized R. The dashed diagonal means all favorable excursion was captured.`}</desc>
        <GridRows scale={yScale} width={width - margin.left - margin.right} left={margin.left} stroke="var(--line)" numTicks={5} />
        <line x1={xScale(0)} x2={xScale(diagonalEnd)} y1={yScale(0)} y2={yScale(diagonalEnd)} stroke="var(--muted)" strokeDasharray="6 5" strokeWidth={1.5} />
        <AxisLeft scale={yScale} left={margin.left} numTicks={5} tickFormat={(value) => `${Number(value).toFixed(1)}R`} stroke="var(--line)" tickStroke="var(--line)" tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "end", dx: -6, dy: 4 })} />
        <AxisBottom top={height - margin.bottom} scale={xScale} numTicks={5} tickFormat={(value) => `${Number(value).toFixed(1)}R`} stroke="var(--line)" tickStroke="var(--line)" label="Maximum favorable excursion" labelProps={{ fill: "var(--muted)", fontSize: 11, textAnchor: "middle" }} tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "middle", dy: 4 })} />
        {points.map((point, index) => (
          <circle key={`${point.symbol}-${index}`} cx={xScale(point.mfeR)} cy={yScale(point.realizedR)} r={5} fill={point.realizedR >= 0 ? "var(--accent)" : "var(--loss)"} stroke="var(--raised)" strokeWidth={2} tabIndex={0} aria-label={`${point.symbol}: ${point.mfeR.toFixed(2)}R favorable excursion, ${point.realizedR.toFixed(2)}R realized, ${point.capturedMovePct.toFixed(1)}% captured`}>
            <title>{`${point.symbol} · MFE ${point.mfeR.toFixed(2)}R · realized ${point.realizedR.toFixed(2)}R · capture ${point.capturedMovePct.toFixed(1)}%`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>MFE in R → realized R · {currency} · manual evidence only</span>
        <span>Dashed line = 100% gross favorable move captured</span>
      </figcaption>
      <div className="sr-only">
        <table><caption>Manual excursion evidence for {currency}</caption><thead><tr><th>Symbol</th><th>MFE</th><th>Realized</th><th>Captured</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.symbol}-${index}`}><td>{point.symbol}</td><td>{point.mfeR.toFixed(2)}R</td><td>{point.realizedR.toFixed(2)}R</td><td>{point.capturedMovePct.toFixed(1)}%</td></tr>)}</tbody></table>
      </div>
    </figure>
  );
}
