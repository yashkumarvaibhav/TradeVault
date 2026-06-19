import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink shadow-[var(--shadow-sm)] transition-colors placeholder:text-faint hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
