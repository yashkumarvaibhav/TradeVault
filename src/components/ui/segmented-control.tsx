"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

function SegmentedControl({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root className={cn("inline-flex min-h-11 items-center rounded-md border border-line bg-sidebar p-1", className)} {...props} />;
}

function SegmentedControlItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn("inline-flex min-h-9 items-center justify-center gap-2 rounded-sm px-3 text-sm font-semibold text-muted transition-colors hover:text-ink data-[state=on]:bg-raised data-[state=on]:text-ink data-[state=on]:shadow-[var(--shadow-sm)] disabled:opacity-50", className)}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
