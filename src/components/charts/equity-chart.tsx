"use client";

import * as React from "react";
import { AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";

import type { Currency } from "@/lib/domain/types";
import { ChartStatePanel, type ChartRenderState } from "@/components/charts/chart-state";

export interface EquityDatum {
  label: string;
  value: number;
}

const width = 760;
const height = 286;
const margin = { top: 18, right: 18, bottom: 38, left: 18 };

export function EquityChart({
  points,
  currency,
  mode = "equity",
  state = "ready",
  stateMessage,
}: {
  points: EquityDatum[];
  currency: Currency;
  mode?: "equity" | "drawdown";
  state?: ChartRenderState;
  stateMessage?: string;
}) {
  const id = React.useId();
  const effectiveState = state === "ready" && points.length === 0 ? "empty" : state;
  if (effectiveState !== "ready") return <ChartStatePanel state={effectiveState} message={stateMessage} />;

  const values = points.map(({ value }) => value);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const padding = Math.max((high - low) * 0.14, currency === "INR" ? 1_000 : 25);
  const xScale = scaleLinear({ domain: [0, Math.max(points.length - 1, 1)], range: [margin.left, width - margin.right] });
  const yScale = scaleLinear({ domain: [low - padding, high + padding], range: [height - margin.bottom, margin.top], nice: true });
  const format = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  });
  const metric = mode === "equity" ? "Cumulative net P&L" : "Underwater drawdown";
  const chartTitle = mode === "equity" ? `${currency} cumulative net P&L equity curve` : `${currency} underwater drawdown curve`;
  const lineColor = mode === "equity" ? "var(--accent)" : "var(--loss)";
  const fillColor = mode === "equity" ? "var(--accent-soft)" : "color-mix(in srgb, var(--loss) 12%, transparent)";

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>{chartTitle}</title>
        <desc id={`${id}-desc`}>{`${metric}, measured in ${currency}, for closed trades in the selected scope. ${points.length} checkpoints. Values range from ${format.format(low)} to ${format.format(high)}.`}</desc>
        <Group>
          <GridRows
            scale={yScale}
            width={width - margin.left - margin.right}
            left={margin.left}
            stroke="var(--line)"
            numTicks={4}
          />
          <line
            data-zero-line="true"
            x1={margin.left}
            x2={width - margin.right}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke="var(--muted)"
            strokeDasharray="4 5"
            strokeWidth={1}
          />
          <AreaClosed
            data={points}
            x={(_, index) => xScale(index)}
            y={({ value }) => yScale(value)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={fillColor}
            stroke="transparent"
          />
          <LinePath
            data={points}
            x={(_, index) => xScale(index)}
            y={({ value }) => yScale(value)}
            curve={curveMonotoneX}
            stroke={lineColor}
            strokeWidth={3}
          />
          {points.map((point, index) => (
            <circle
              key={`${point.label}-${point.value}`}
              cx={xScale(index)}
              cy={yScale(point.value)}
              r={4}
              fill="var(--raised)"
              stroke={lineColor}
              strokeWidth={2}
              tabIndex={0}
              aria-label={`${point.label}: ${format.format(point.value)} ${metric} in ${currency}`}
            >
              <title>{`${point.label}: ${format.format(point.value)}`}</title>
            </circle>
          ))}
          <AxisBottom
            top={height - margin.bottom}
            scale={xScale}
            numTicks={Math.min(5, points.length)}
            tickFormat={(value) => points[Math.round(Number(value))]?.label ?? ""}
            stroke="var(--line)"
            tickStroke="var(--line)"
            tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "middle", dy: 4 })}
          />
        </Group>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{metric} · {currency} · closed trades · selected scope</span>
        <span>Zero line shown · {points.length} checkpoints</span>
      </figcaption>
      <div className="sr-only">
        <table className="w-px max-w-px table-fixed break-all whitespace-normal">
          <caption>{metric} values in {currency} for the selected journal scope</caption>
          <thead><tr><th>Checkpoint</th><th>{currency}</th></tr></thead>
          <tbody>{points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{format.format(point.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
