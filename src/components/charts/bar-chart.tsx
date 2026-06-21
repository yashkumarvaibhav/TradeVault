"use client";

import * as React from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { scaleBand, scaleLinear } from "@visx/scale";

import { compactMoneyFormatter, currencyFromUnit } from "@/lib/chart-format";
import { ChartStatePanel, type ChartRenderState } from "@/components/charts/chart-state";

export interface BarDatum {
  label: string;
  value: number;
}

const width = 720;
const height = 284;
const margin = { top: 26, right: 16, bottom: 42, left: 58 };

export function BarChart({
  data,
  metric,
  unit,
  scope,
  sampleSize,
  formatValue = (value) => String(value),
  state = "ready",
  stateMessage,
}: {
  data: BarDatum[];
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

  const values = data.map(({ value }) => value);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const spread = Math.max(high - low, 1);
  const xScale = scaleBand({ domain: data.map(({ label }) => label), range: [margin.left, width - margin.right], padding: 0.34 });
  const yScale = scaleLinear({ domain: [low - spread * 0.12, high + spread * 0.12], range: [height - margin.bottom, margin.top], nice: true });
  const currency = currencyFromUnit(unit);
  const compact = currency
    ? compactMoneyFormatter(currency)
    : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
  // Direct value labels only stay legible when bands are wide enough.
  const showBarLabels = data.length <= 14;

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{`${metric} bar chart`}</title>
        <desc id={`${id}-desc`}>{`${metric}, measured in ${unit}, for ${scope}. ${sampleSize} trades in sample. A visible zero line separates gains from losses.`}</desc>
        <GridRows scale={yScale} width={width - margin.left - margin.right} left={margin.left} stroke="var(--line)" numTicks={4} />
        <AxisLeft
          scale={yScale}
          left={margin.left}
          numTicks={4}
          tickFormat={(value) => compact.format(Number(value))}
          stroke="var(--line)"
          tickStroke="var(--line)"
          tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "end", dx: -6, dy: 4 })}
        />
        <line data-zero-line="true" x1={margin.left} x2={width - margin.right} y1={yScale(0)} y2={yScale(0)} stroke="var(--muted)" strokeDasharray="4 5" />
        {data.map((datum) => {
          const x = xScale(datum.label) ?? 0;
          const zero = yScale(0);
          const valueY = yScale(datum.value);
          const positive = datum.value >= 0;
          return (
            <React.Fragment key={datum.label}>
              <rect
                x={x}
                y={positive ? valueY : zero}
                width={xScale.bandwidth()}
                height={Math.max(Math.abs(zero - valueY), 1)}
                rx={6}
                fill={positive ? "var(--profit)" : "var(--loss)"}
                opacity={0.84}
                tabIndex={0}
                aria-label={`${datum.label}: ${formatValue(datum.value)} ${unit}`}
              >
                <title>{`${datum.label}: ${formatValue(datum.value)}`}</title>
              </rect>
              {showBarLabels ? (
                <text
                  x={x + xScale.bandwidth() / 2}
                  y={positive ? valueY - 7 : valueY + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={positive ? "var(--profit)" : "var(--loss)"}
                >
                  {compact.format(datum.value)}
                </text>
              ) : null}
            </React.Fragment>
          );
        })}
        <AxisBottom
          top={height - margin.bottom}
          scale={xScale}
          stroke="var(--line)"
          tickStroke="var(--line)"
          tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 11, textAnchor: "middle", dy: 4 })}
        />
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>{metric} · {unit} · {scope}</span>
        <span>Zero line shown · {sampleSize} trades</span>
      </figcaption>
      <div className="sr-only">
        <table className="w-px max-w-px table-fixed break-all whitespace-normal">
          <caption>{metric} values for {scope}</caption>
          <thead><tr><th>Period</th><th>{unit}</th></tr></thead>
          <tbody>{data.map((datum) => <tr key={datum.label}><td>{datum.label}</td><td>{formatValue(datum.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
