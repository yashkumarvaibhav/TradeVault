"use client";

import { AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";

import type { Currency } from "@/lib/domain/types";

export interface EquityDatum {
  label: string;
  value: number;
}

const width = 760;
const height = 286;
const margin = { top: 18, right: 18, bottom: 38, left: 18 };

export function EquityChart({ points, currency }: { points: EquityDatum[]; currency: Currency }) {
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

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby={`equity-${currency}-title equity-${currency}-desc`}
      >
        <title id={`equity-${currency}-title`}>{`${currency} cumulative net P&L equity curve`}</title>
        <desc id={`equity-${currency}-desc`}>{`Preview sample of ${points.length} closed-trade checkpoints. Values range from ${format.format(low)} to ${format.format(high)}.`}</desc>
        <Group>
          <GridRows
            scale={yScale}
            width={width - margin.left - margin.right}
            left={margin.left}
            stroke="var(--line)"
            numTicks={4}
          />
          <line
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
            fill="var(--accent-soft)"
            stroke="transparent"
          />
          <LinePath
            data={points}
            x={(_, index) => xScale(index)}
            y={({ value }) => yScale(value)}
            curve={curveMonotoneX}
            stroke="var(--accent)"
            strokeWidth={3}
          />
          {points.map((point, index) => (
            <circle
              key={`${point.label}-${point.value}`}
              cx={xScale(index)}
              cy={yScale(point.value)}
              r={4}
              fill="var(--raised)"
              stroke="var(--accent)"
              strokeWidth={2}
              tabIndex={0}
              aria-label={`${point.label}: ${format.format(point.value)} cumulative ${currency} net P&L`}
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
        <span>Cumulative net P&amp;L · {currency} · closed trades · preview sample</span>
        <span>Zero line shown · {points.length} checkpoints</span>
      </figcaption>
    </figure>
  );
}
