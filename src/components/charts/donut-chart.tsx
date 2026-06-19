"use client";

import * as React from "react";
import { Group } from "@visx/group";
import { Pie } from "@visx/shape";

import { ChartStatePanel, type ChartRenderState } from "@/components/charts/chart-state";

export interface DonutDatum {
  label: string;
  value: number;
}

const width = 320;
const height = 224;
const colors = ["var(--accent)", "var(--warn)", "var(--profit)", "var(--loss)"];

export function DonutChart({
  data,
  metric,
  unit,
  scope,
  sampleSize,
  state = "ready",
  stateMessage,
}: {
  data: DonutDatum[];
  metric: string;
  unit: string;
  scope: string;
  sampleSize: number;
  state?: ChartRenderState;
  stateMessage?: string;
}) {
  const id = React.useId();
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  const effectiveState = state === "ready" && (data.length === 0 || total <= 0) ? "empty" : state;
  if (effectiveState !== "ready") return <ChartStatePanel state={effectiveState} message={stateMessage} className="min-h-56" />;

  const radius = Math.min(width, height) / 2 - 14;

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto h-auto w-full max-w-xs" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{`${metric} donut chart`}</title>
        <desc id={`${id}-desc`}>{`${metric}, measured in ${unit}, for ${scope}. ${sampleSize} trades in sample.`}</desc>
        <Group top={height / 2} left={width / 2}>
          <Pie data={data} pieValue={({ value }) => value} outerRadius={radius} innerRadius={radius * 0.62} padAngle={0.025}>
            {(pie) => pie.arcs.map((arc, index) => {
              const path = pie.path(arc) ?? undefined;
              const percent = (arc.data.value / total) * 100;
              return (
                <path
                  key={arc.data.label}
                  d={path}
                  fill={colors[index % colors.length]}
                  opacity={0.88}
                  tabIndex={0}
                  aria-label={`${arc.data.label}: ${arc.data.value} ${unit}, ${percent.toFixed(1)}%`}
                >
                  <title>{`${arc.data.label}: ${arc.data.value} ${unit} (${percent.toFixed(1)}%)`}</title>
                </path>
              );
            })}
          </Pie>
          <text textAnchor="middle" dy="-0.15em" fill="var(--ink)" fontFamily="var(--font-newsreader)" fontSize="28">{total}</text>
          <text textAnchor="middle" dy="1.4em" fill="var(--muted)" fontFamily="Arial, sans-serif" fontSize="11">{unit}</text>
        </Group>
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted" aria-hidden="true">
        {data.map((datum, index) => (
          <span key={datum.label} className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
            {datum.label} · {((datum.value / total) * 100).toFixed(0)}%
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">{metric} · {unit} · {scope} · {sampleSize} trades</figcaption>
      <div className="sr-only">
        <table className="w-px max-w-px table-fixed break-all whitespace-normal">
          <caption>{metric} values for {scope}</caption>
          <thead><tr><th>Segment</th><th>{unit}</th><th>Share</th></tr></thead>
          <tbody>{data.map((datum) => <tr key={datum.label}><td>{datum.label}</td><td>{datum.value}</td><td>{((datum.value / total) * 100).toFixed(1)}%</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
