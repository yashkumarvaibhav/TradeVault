import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarChart } from "./bar-chart";
import { DonutChart } from "./donut-chart";
import { HeatmapChart } from "./heatmap-chart";
import { HistogramChart } from "./histogram-chart";

describe("accessible chart wrappers", () => {
  it("labels bar metric, unit, scope, sample, zero line, and data alternative", () => {
    const { container } = render(
      <BarChart
        data={[{ label: "May", value: -20 }, { label: "Jun", value: 80 }]}
        metric="Monthly net P&L"
        unit="USD"
        scope="closed trades · 90 days"
        sampleSize={10}
        formatValue={(value) => `$${value}`}
      />,
    );

    expect(screen.getByRole("img", { name: /Monthly net P&L bar chart/ })).toBeVisible();
    expect(container.querySelector("[data-zero-line='true']")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Monthly net P&L values/i })).toHaveTextContent("$-20");
    expect(screen.getByText("Zero line shown · 10 trades")).toBeVisible();
  });

  it("renders explicit loading and empty states without a misleading chart", () => {
    const { rerender } = render(
      <BarChart data={[]} metric="Monthly net P&L" unit="INR" scope="30 days" sampleSize={0} state="loading" />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    rerender(<BarChart data={[]} metric="Monthly net P&L" unit="INR" scope="30 days" sampleSize={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("No trades match this scope yet");
  });

  it("describes histogram frequency and provides a tabular alternative", () => {
    render(
      <HistogramChart
        data={[{ range: "-2% to 0%", count: 2 }, { range: "0% to 2%", count: 5 }]}
        metric="Return distribution"
        scope="INR closed trades · 30 days"
        sampleSize={7}
      />,
    );

    expect(screen.getByRole("img", { name: /Return distribution histogram/ })).toBeVisible();
    expect(screen.getByRole("table", { name: /Return distribution buckets/i })).toHaveTextContent("5");
    expect(screen.getByText(/Frequency = trade count/)).toBeVisible();
  });

  it("labels donut segments and exposes their exact shares as data", () => {
    render(
      <DonutChart
        data={[{ label: "Long", value: 6 }, { label: "Short", value: 4 }]}
        metric="Long vs Short"
        unit="closed trades"
        scope="USD · 30 days"
        sampleSize={10}
      />,
    );

    expect(screen.getByRole("img", { name: /Long vs Short donut chart/ })).toBeVisible();
    expect(screen.getByLabelText("Long: 6 closed trades, 60.0%")).toBeVisible();
    expect(screen.getByRole("table", { name: /Long vs Short values/i })).toHaveTextContent("40.0%");
  });

  it("distinguishes heatmap gains, losses, and no-trade cells", () => {
    render(
      <HeatmapChart
        data={[
          { row: "W1", column: "Mon", label: "June 1", value: 80 },
          { row: "W1", column: "Tue", label: "June 2", value: -20 },
          { row: "W1", column: "Wed", label: "June 3", value: null },
        ]}
        rows={["W1"]}
        columns={["Mon", "Tue", "Wed"]}
        metric="Daily outcome intensity"
        unit="USD"
        scope="June preview"
        sampleSize={2}
        formatValue={(value) => `$${value}`}
      />,
    );

    expect(screen.getByRole("img", { name: /Daily outcome intensity heatmap/ })).toBeVisible();
    expect(screen.getByLabelText("June 3: no trades")).toBeVisible();
    expect(screen.getByRole("table", { name: /Daily outcome intensity values/i })).toHaveTextContent("$-20");
  });
});
