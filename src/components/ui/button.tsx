import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-contrast hover:bg-accent-hover",
        secondary: "border-line bg-raised text-ink shadow-[var(--shadow-sm)] hover:bg-hover",
        outline: "border-line bg-transparent text-body hover:border-line-strong hover:bg-accent-soft hover:text-ink",
        ghost: "text-body hover:bg-hover hover:text-ink",
        destructive: "bg-danger text-white hover:opacity-90",
      },
      size: {
        default: "h-11",
        compact: "h-11 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
