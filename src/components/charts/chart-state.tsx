import { CircleAlert, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChartRenderState = "ready" | "loading" | "empty" | "insufficient" | "error";

export function ChartStatePanel({
  state,
  message,
  className,
}: {
  state: Exclude<ChartRenderState, "ready">;
  message?: string;
  className?: string;
}) {
  const copy = {
    loading: "Loading chart data…",
    empty: "No trades match this scope yet.",
    insufficient: "More closed trades are needed for this view.",
    error: "This chart could not be loaded.",
  }[state];

  if (state === "loading") {
    return (
      <div className={cn("flex min-h-64 flex-col justify-end gap-3 rounded-md border border-line bg-sidebar p-5", className)} role="status" aria-busy="true">
        <span className="sr-only">{message ?? copy}</span>
        <div className="flex h-44 items-end gap-3" aria-hidden="true">
          {[38, 62, 45, 82, 58, 72].map((height, index) => (
            <span key={`${height}-${index}`} className="flex-1 animate-pulse rounded-sm bg-accent-soft" style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted"><LoaderCircle className="size-4 animate-spin" /> {message ?? copy}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-line p-8 text-center", className)} role={state === "error" ? "alert" : "status"}>
      <CircleAlert className={cn("mb-3 size-6 text-muted", state === "error" && "text-danger")} aria-hidden="true" />
      <p className="text-sm font-semibold text-ink">{message ?? copy}</p>
      <p className="mt-1 text-xs text-muted">Adjust the scope or add more reviewed trades.</p>
    </div>
  );
}
