import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  regionLabel,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string; regionLabel?: string }) {
  // The wrapper can scroll horizontally on narrow viewports, so it must be reachable by
  // keyboard (WCAG 2.1.1 / axe scrollable-region-focusable). tabIndex makes it focusable
  // and scrollable with arrow keys; when a label is supplied it becomes a named region.
  return (
    <div
      className={cn("w-full overflow-x-auto rounded-md border border-line", containerClassName)}
      tabIndex={0}
      role={regionLabel ? "region" : undefined}
      aria-label={regionLabel}
    >
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("border-b border-line bg-sidebar text-left", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-line bg-raised", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-hover", className)} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  // Headers wrap (rather than nowrap) so dense tables stay legible on narrow viewports instead of
  // colliding with the next column; align to the bottom so multi-line headers line up with single ones.
  return <th className={cn("h-11 px-3 align-bottom text-xs font-semibold uppercase leading-tight tracking-[0.08em] text-muted", className)} {...props} />;
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("h-12 whitespace-nowrap px-3 text-body", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("mt-3 text-left text-xs leading-relaxed text-muted", className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow };
