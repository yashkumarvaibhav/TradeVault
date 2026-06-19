"use client";

import * as React from "react";
import { scaleBand } from "@visx/scale";

import { ChartStatePanel, type ChartRenderState } from "@/components/charts/chart-state";

export interface HeatmapDatum {
  row: string;
  column: string;
  label: string;
  value: number | null;
}

const width = 720;
const height = 286;
const margin = { top: 30, right: 12, bottom: 18, left: 52 };

export function HeatmapChart({
  data,
  rows,
  columns,
  metric,
  unit,
  scope,
  sampleSize,
  formatValue = (value) => String(value),
  state = "ready",
  stateMessage,
}: {
  data: HeatmapDatum[];
  rows: string[];
  columns: string[];
  metric: string;
  unit: string;
  scope: string;
  sampleSize: number;
  formatValue?: (value: number) => string;
  state?: ChartRenderState;
  stateMessage?: string;
}) {
  const id = React.useId();
  const effectiveState = state === "ready" && data.length === 0 ? "empty" : state;
  if (effectiveState !== "ready") return <ChartStatePanel state={effectiveState} message={stateMessage} />;

  const xScale = scaleBand({ domain: columns, range: [margin.left, width - margin.right], padding: 0.12 });
  const yScale = scaleBand({ domain: rows, range: [margin.top, height - margin.bottom], padding: 0.12 });
  const maxMagnitude = Math.max(...data.map(({ value }) => Math.abs(value ?? 0)), 1);

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{`${metric} heatmap`}</title>
        <desc id={`${id}-desc`}>{`${metric}, measured in ${unit}, for ${scope}. ${sampleSize} trades in sample. Green cells are gains, red cells are losses, and outlined cells have no trades.`}</desc>
        {columns.map((column) => <text key={column} x={(xScale(column) ?? 0) + xScale.bandwidth() / 2} y={17} textAnchor="middle" fill="var(--muted)" fontSize="11">{column}</text>)}
        {rows.map((row) => <text key={row} x={margin.left - 9} y={(yScale(row) ?? 0) + yScale.bandwidth() / 2 + 4} textAnchor="end" fill="var(--muted)" fontSize="11">{row}</text>)}
        {data.map((datum) => {
          const magnitude = Math.abs(datum.value ?? 0) / maxMagnitude;
          const fill = datum.value == null ? "var(--raised)" : datum.value >= 0 ? "var(--profit)" : "var(--loss)";
          const opacity = datum.value == null ? 1 : 0.18 + magnitude * 0.7;
          const valueLabel = datum.value == null ? "no trades" : formatValue(datum.value);
          return (
            <rect
              key={`${datum.row}-${datum.column}`}
              x={xScale(datum.column)}
              y={yScale(datum.row)}
              width={xScale.bandwidth()}
              height={yScale.bandwidth()}
              rx={7}
              fill={fill}
              fillOpacity={opacity}
              stroke={datum.value == null ? "var(--line)" : fill}
              tabIndex={0}
              aria-label={`${datum.label}: ${valueLabel} ${datum.value == null ? "" : unit}`.trim()}
            >
              <title>{`${datum.label}: ${valueLabel}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>{metric} · {unit} · {scope}</span>
        <span className="inline-flex items-center gap-3" aria-hidden="true">
          <i className="size-2 rounded-full bg-loss" /> Loss
          <i className="size-2 rounded-full border border-line bg-raised" /> No trade
          <i className="size-2 rounded-full bg-profit" /> Profit
        </span>
      </div>
      <figcaption className="mt-2 text-xs text-muted">Diverging zero-centered intensity · {sampleSize} trades</figcaption>
      <div className="sr-only">
        <table className="w-px max-w-px table-fixed break-all whitespace-normal">
          <caption>{metric} values for {scope}</caption>
          <thead><tr><th>Cell</th><th>{unit}</th></tr></thead>
          <tbody>{data.map((datum) => <tr key={`${datum.row}-${datum.column}`}><td>{datum.label}</td><td>{datum.value == null ? "No trades" : formatValue(datum.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
