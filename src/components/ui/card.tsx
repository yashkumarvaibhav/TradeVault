import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-lg border border-line bg-raised shadow-[var(--shadow-sm)]", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 items-start justify-between gap-4 p-5 pb-3", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-serif text-xl font-medium tracking-[-0.025em] text-ink", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 p-5 pt-2", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
