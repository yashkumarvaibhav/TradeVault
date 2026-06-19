"use client";

import * as React from "react";
import { AxisBottom } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { scaleBand, scaleLinear } from "@visx/scale";

import { ChartStatePanel, type ChartRenderState } from "@/components/charts/chart-state";

export interface HistogramDatum {
  range: string;
  count: number;
}

const width = 720;
const height = 284;
const margin = { top: 18, right: 14, bottom: 48, left: 14 };

export function HistogramChart({
  data,
  metric,
  scope,
  sampleSize,
  state = "ready",
  stateMessage,
}: {
  data: HistogramDatum[];
  metric: string;
  scope: string;
  sampleSize: number;
  state?: ChartRenderState;
  stateMessage?: string;
}) {
  const id = React.useId();
  const effectiveState = state === "ready" && data.length === 0 ? "empty" : state;
  if (effectiveState !== "ready") return <ChartStatePanel state={effectiveState} message={stateMessage} />;

  const high = Math.max(...data.map(({ count }) => count), 1);
  const xScale = scaleBand({ domain: data.map(({ range }) => range), range: [margin.left, width - margin.right], padding: 0.22 });
  const yScale = scaleLinear({ domain: [0, high], range: [height - margin.bottom, margin.top], nice: true });

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{`${metric} histogram`}</title>
        <desc id={`${id}-desc`}>{`${metric} grouped into percentage-return ranges for ${scope}. Bar height is trade count. ${sampleSize} trades in sample.`}</desc>
        <GridRows scale={yScale} width={width - margin.left - margin.right} left={margin.left} stroke="var(--line)" numTicks={4} />
        <line data-zero-line="true" x1={margin.left} x2={width - margin.right} y1={yScale(0)} y2={yScale(0)} stroke="var(--muted)" />
        {data.map((datum) => {
          const x = xScale(datum.range) ?? 0;
          const y = yScale(datum.count);
          return (
            <rect
              key={datum.range}
              x={x}
              y={y}
              width={xScale.bandwidth()}
              height={Math.max(yScale(0) - y, 1)}
              rx={6}
              fill="var(--accent)"
              opacity={0.82}
              tabIndex={0}
              aria-label={`${datum.range}: ${datum.count} trades`}
            >
              <title>{`${datum.range}: ${datum.count} trades`}</title>
            </rect>
          );
        })}
        <AxisBottom
          top={height - margin.bottom}
          scale={xScale}
          stroke="var(--line)"
          tickStroke="var(--line)"
          tickLabelProps={() => ({ fill: "var(--muted)", fontSize: 10, textAnchor: "middle", dy: 4 })}
        />
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>{metric} · return % buckets · {scope}</span>
        <span>Frequency = trade count · {sampleSize} trades</span>
      </figcaption>
      <div className="sr-only">
        <table className="w-px max-w-px table-fixed break-all whitespace-normal">
          <caption>{metric} buckets for {scope}</caption>
          <thead><tr><th>Return range</th><th>Trade count</th></tr></thead>
          <tbody>{data.map((datum) => <tr key={datum.range}><td>{datum.range}</td><td>{datum.count}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
