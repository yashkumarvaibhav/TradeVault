"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowDownRight,
  ArrowUpRight,
  CornerDownLeft,
  Moon,
  Plus,
  StickyNote,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { navItems } from "@/components/nav-items";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/components/ui/toaster";
import type { Currency } from "@/lib/domain/types";
import { toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Small uppercase type tag shown on each result (TRADES / NOTES / VIEW …). */
function TypeChip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        tone === "accent" ? "bg-accent-soft text-accent" : "border border-line text-faint",
      )}
    >
      {children}
    </span>
  );
}

function moneyLabel(currency: Currency, amount: number) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(Math.abs(amount));
  return `${amount >= 0 ? "+" : "−"}${formatted}`;
}

/**
 * Sample records are explicitly preview-only until My Trades (P3) wires real,
 * tenant-scoped search. Each carries its own currency — INR and USD are never combined.
 */
interface SampleRecord {
  kind: "trade" | "note";
  title: string;
  side?: "Long" | "Short";
  currency?: Currency;
  amount?: number;
  meta?: string;
  keywords: string;
}

const sampleRecords: SampleRecord[] = [
  { kind: "trade", title: "RELIANCE", side: "Long", currency: "INR", amount: 4200, keywords: "equity nse cash" },
  { kind: "trade", title: "AAPL", side: "Short", currency: "USD", amount: -118.4, keywords: "us equity nasdaq" },
  { kind: "note", title: "Breakout playbook — discipline review", meta: "Journal", keywords: "playbook strategy mistakes" },
];

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  // Run an action and close the palette. Closing first keeps focus return predictable.
  const run = React.useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 opacity-0 backdrop-blur-[2px] transition-opacity data-[state=open]:opacity-100" />
        <DialogPrimitive.Content
          aria-describedby="command-palette-description"
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-raised text-body shadow-[var(--shadow-lg)] outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description id="command-palette-description" className="sr-only">
            Search to jump to a view, run an action, or open a record. Use arrow keys to navigate and Enter to select.
          </DialogPrimitive.Description>

          <Command label="TradeVault command palette" loop>
            <CommandInput aria-label="Search views, actions, and records" placeholder="Search views, actions, records…" />
            <CommandList>
              <CommandEmpty>No matches. Try a view name, “theme”, or “add trade”.</CommandEmpty>

              <CommandGroup heading="Navigate">
                {navItems.map(({ label, icon: Icon, href, active, soon }) => (
                  <CommandItem
                    key={label}
                    value={`${label} go to view page`}
                    onSelect={() =>
                      run(() => {
                        if (active) {
                          router.push(href);
                        } else {
                          toast.info(`${label} arrives in a later phase`, {
                            description: "Navigation is wired; this view is not built yet.",
                          });
                        }
                      })
                    }
                  >
                    <Icon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                    <span className="flex-1 truncate text-ink">{label}</span>
                    {soon ? <TypeChip>Soon</TypeChip> : <TypeChip tone="accent">View</TypeChip>}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Actions">
                <CommandItem
                  value="add trade new entry log"
                  onSelect={() =>
                    run(() =>
                      toast.info("Add Trade workspace is next", {
                        description: "The foundation preview does not write journal data.",
                      }),
                    )
                  }
                >
                  <Plus className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                  <span className="flex-1 truncate text-ink">Add trade</span>
                  <TypeChip>Action</TypeChip>
                </CommandItem>
                <CommandItem
                  value="toggle theme dark light appearance"
                  onSelect={() =>
                    run(() => {
                      const next = toggleTheme();
                      toast.success(`Switched to ${next} theme`);
                    })
                  }
                >
                  <Moon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                  <span className="flex-1 truncate text-ink">Toggle light / dark theme</span>
                  <TypeChip>Action</TypeChip>
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Sample records · preview">
                {sampleRecords.map((record) => (
                  <CommandItem
                    key={`${record.kind}-${record.title}`}
                    value={`${record.title} ${record.keywords} ${record.kind}`}
                    onSelect={() =>
                      run(() =>
                        toast.info("Record search arrives with My Trades", {
                          description: "Live, tenant-scoped results deep-link here in a later phase.",
                        }),
                      )
                    }
                  >
                    {record.kind === "trade" ? (
                      record.side === "Long" ? (
                        <ArrowUpRight className="size-[18px] shrink-0 text-profit" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="size-[18px] shrink-0 text-loss" aria-hidden="true" />
                      )
                    ) : (
                      <StickyNote className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{record.title}</span>
                      <span className="block truncate text-xs text-muted tnum">
                        {record.kind === "trade" && record.currency
                          ? `${record.side} · ${moneyLabel(record.currency, record.amount ?? 0)} · ${record.currency}`
                          : record.meta}
                      </span>
                    </span>
                    <TypeChip>{record.kind === "trade" ? "Trades" : "Notes"}</TypeChip>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>

            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-faint">
              <KbdHint keys={["↑", "↓"]}>Navigate</KbdHint>
              <KbdHint keys={[<CornerDownLeft key="enter" className="size-3" aria-hidden="true" />]}>Select</KbdHint>
              <KbdHint keys={["Esc"]}>Close</KbdHint>
              <span className="ml-auto hidden sm:inline">INR and USD never combined</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function KbdHint({ keys, children }: { keys: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, index) => (
        <kbd
          key={index}
          className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-sm border border-line px-1 text-[10px] text-muted"
        >
          {key}
        </kbd>
      ))}
      <span>{children}</span>
    </span>
  );
}
