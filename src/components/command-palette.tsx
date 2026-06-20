"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenCheck,
  CandlestickChart,
  ChevronRight,
  CornerDownLeft,
  LoaderCircle,
  Moon,
  Plus,
  StickyNote,
  Target,
} from "lucide-react";

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
import type { VaultSearchItem, VaultSearchKind } from "@/lib/domain/vault-search";
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

const typeLabels: Record<VaultSearchKind, string> = {
  trade: "Trades",
  instrument: "Instruments",
  strategy: "Strategies",
  playbook: "Playbooks",
  note: "Notes",
};

async function fetchVaultRecords(query: string, signal: AbortSignal): Promise<VaultSearchItem[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Vault search request failed.");
  const payload = await response.json() as { results?: VaultSearchItem[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate?: (href: string) => void;
  searchRecords?: (query: string, signal: AbortSignal) => Promise<VaultSearchItem[]>;
}

export function CommandPalette({
  open,
  onOpenChange,
  navigate = (href) => window.location.assign(href),
  searchRecords = fetchVaultRecords,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [records, setRecords] = React.useState<VaultSearchItem[]>([]);
  const [recordsQuery, setRecordsQuery] = React.useState("");
  const [searchState, setSearchState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setRecords([]);
      setRecordsQuery("");
      setSearchState("idle");
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchState("loading");
      setRecords([]);
      setRecordsQuery("");
      searchRecords(query, controller.signal)
        .then((nextRecords) => {
          if (controller.signal.aborted) return;
          setRecords(nextRecords);
          setRecordsQuery(query);
          setSearchState("ready");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setRecords([]);
          setRecordsQuery("");
          setSearchState("error");
        });
    }, query ? 140 : 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, searchRecords]);

  // Run an action and close the palette. Closing first keeps focus return predictable.
  const run = React.useCallback(
    (action: () => void) => {
      handleOpenChange(false);
      action();
    },
    [handleOpenChange],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 opacity-0 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none data-[state=open]:opacity-100" />
        <DialogPrimitive.Content
          aria-describedby="command-palette-description"
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-raised text-body shadow-[var(--shadow-lg)] outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description id="command-palette-description" className="sr-only">
            Search to jump to a view, run an action, or open a record. Use arrow keys to navigate and Enter to select.
          </DialogPrimitive.Description>

          <Command label="TradeVault command palette" loop>
            <CommandInput
              aria-label="Search views, actions, and records"
              placeholder="Search views, actions, records…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{searchState === "loading" ? "Searching your vault…" : `No matches${query ? ` for “${query}”` : ""}.`}</CommandEmpty>

              {searchState === "loading" ? (
                <div role="status" aria-live="polite" className="flex min-h-12 items-center gap-2 px-3 text-xs text-muted">
                  <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Searching tenant-scoped records…
                </div>
              ) : null}

              {searchState === "error" ? (
                <div role="alert" className="mx-2 my-1 rounded-sm border border-line bg-sidebar px-3 py-2 text-xs text-muted">
                  Record search is temporarily unavailable. Navigation and actions still work.
                </div>
              ) : null}

              {records.length > 0 ? <CommandGroup heading={query ? "Matching records" : "Recent records & libraries"}>
                {records.map((record) => (
                  <CommandItem
                    key={`${record.kind}-${record.id}`}
                    // The server may match private body text that is intentionally absent from
                    // this DTO. Including the user's own query keeps cmdk from hiding that safe result.
                    value={`${record.title} ${record.meta} ${typeLabels[record.kind]} ${record.kind} ${recordsQuery}`}
                    onSelect={() => run(() => navigate(record.href))}
                  >
                    {record.kind === "trade" ? (
                      record.direction === "Long" ? (
                        <ArrowUpRight className="size-[18px] shrink-0 text-profit" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="size-[18px] shrink-0 text-loss" aria-hidden="true" />
                      )
                    ) : record.kind === "instrument" ? (
                      <CandlestickChart className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                    ) : record.kind === "strategy" ? (
                      <Target className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                    ) : record.kind === "playbook" ? (
                      <BookOpenCheck className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                    ) : (
                      <StickyNote className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{record.title}</span>
                      <span className="block truncate text-xs text-muted tnum">
                        {record.kind === "trade" && record.currency
                          ? `${record.meta}${record.amount == null ? "" : ` · ${moneyLabel(record.currency, record.amount)}`} · ${record.currency}`
                          : record.meta}
                      </span>
                    </span>
                    <TypeChip>{typeLabels[record.kind]}</TypeChip>
                    <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                  </CommandItem>
                ))}
              </CommandGroup> : null}

              <CommandGroup heading="Navigate">
                {navItems.map(({ label, icon: Icon, href, active, soon }) => (
                  <CommandItem
                    key={label}
                    value={`${label} go to view page`}
                    onSelect={() =>
                      run(() => {
                        if (active) {
                          navigate(href);
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
                    run(() => navigate("/trades/new"))
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
