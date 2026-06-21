"use client";

import * as React from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { scaleLinear } from "@visx/scale";

const width = 760;
const height = 320;
const margin = { top: 18, right: 20, bottom: 38, left: 58 };

type EquityPoint = { step: number; valueR: number };

export function WhatIfEquityChart({
  baseline,
  scenario,
  currency,
}: {
  baseline: EquityPoint[];
  scenario: EquityPoint[];
  currency: string;
}) {
  const id = React.useId();
  const all = [...baseline, ...scenario];
  if (!all.length) return null;
  const maxStep = Math.max(...all.map((point) => point.step), 1);
  const low = Math.min(0, ...all.map((point) => point.valueR));
  const high = Math.max(0, ...all.map((point) => point.valueR));
  const pad = Math.max((high - low) * 0.1, 0.5);
  const xScale = scaleLinear({ domain: [0, maxStep], range: [margin.left, width - margin.right] });
  const yScale = scaleLinear({ domain: [low - pad, high + pad], range: [height - margin.bottom, margin.top], nice: true });
  const path = (points: EquityPoint[]) => `M ${points.map((point) => `${xScale(point.step).toFixed(2)},${yScale(point.valueR).toFixed(2)}`).join(" L ")}`;
  const baselineFinal = baseline.at(-1)?.valueR ?? 0;
  const scenarioFinal = scenario.at(-1)?.valueR ?? 0;

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Baseline and What-If cumulative R for {currency}</title>
        <desc id={`${id}-desc`}>The dashed baseline ends at {baselineFinal.toFixed(1)}R. The solid scenario ends at {scenarioFinal.toFixed(1)}R. Historical scenario, not a forecast.</desc>
        <AxisLeft
          scale={yScale}
          left={margin.left}
          numTicks={5}
          tickFormat={(value) => `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}R`}
          stroke="var(--line)"
          tickStroke="var(--line)"
          tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "end", dx: -6, dy: 4 })}
        />
        <line x1={margin.left} x2={width - margin.right} y1={yScale(0)} y2={yScale(0)} stroke="var(--line)" strokeWidth={1} />
        <path d={path(baseline)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="7 6" strokeLinejoin="round" />
        <path d={path(scenario)} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" />
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
        <span className="flex flex-wrap items-center gap-3">
          <span><span className="mr-1 inline-block h-0.5 w-5 border-t-2 border-dashed border-muted align-middle" aria-hidden="true" />Baseline</span>
          <span><span className="mr-1 inline-block h-0.5 w-5 bg-accent align-middle" aria-hidden="true" />Scenario</span>
        </span>
        <span>Cumulative R · trade sequence on the x-axis</span>
      </figcaption>
    </figure>
  );
}
