import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex min-h-7 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "border-line bg-raised text-muted",
        accent: "border-line-strong bg-accent-soft text-ink",
        profit: "border-profit/25 bg-profit/10 text-profit",
        loss: "border-loss/25 bg-loss/10 text-loss",
        warning: "border-warn/25 bg-warn/10 text-warn",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Chip({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

export { Chip, chipVariants };
