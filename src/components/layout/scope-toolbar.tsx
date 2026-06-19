import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ScopeToolbar({
  children,
  note,
  label = "View scope",
  className,
}: {
  children: ReactNode;
  note?: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-sidebar p-3", className)} aria-label={label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {children}
        {note && <div className="text-xs leading-relaxed text-muted sm:ml-auto sm:max-w-md sm:pb-3">{note}</div>}
      </div>
    </section>
  );
}

export function ScopeField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      {children}
    </div>
  );
}
