"use client";

import * as React from "react";
import { Menu, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { navItems } from "@/components/nav-items";
import { MarketModeSwitch } from "@/components/market-mode-switch";
import { ProfileMenu } from "@/components/profile-menu";
import { TourProvider } from "@/components/tour/tour-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/domain/types";

// The command palette (cmdk + the search client) is closed by default on every page, so it is
// lazily loaded on first open instead of shipping in the eager bundle of every authenticated route.
const CommandPalette = dynamic(() => import("@/components/command-palette").then((m) => m.CommandPalette));

export interface AppShellUser {
  displayName: string;
  username: string;
  currency?: Currency;
  /** Screen-tour keys the user has already seen (server-persisted onboarding state). */
  completedTours?: string[];
}

function Navigation({ mobile = false, user }: { mobile?: boolean; user: AppShellUser }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className={cn("border-b border-line px-5 py-5", mobile && "pr-14")}>
        <Wordmark />
        <p className="mt-2 text-xs text-muted">Trading journal & review</p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Primary navigation">
        {navItems.map(({ label, icon: Icon, href, active }) => {
          const current = active && pathname === href;
          return active ? (
            <Link
              key={label}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-hover hover:text-ink",
                current && "border border-line-strong bg-accent-soft font-semibold text-ink",
                !current && "text-muted",
              )}
            >
              <Icon className={cn("size-[18px]", current && "text-accent")} aria-hidden="true" />
              {label}
            </Link>
          ) : (
            <span
              key={label}
              aria-disabled="true"
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted opacity-70"
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">Soon</span>
            </span>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-hover hover:text-ink",
            pathname === "/settings" ? "border border-line-strong bg-accent-soft font-semibold text-ink" : "text-muted",
          )}
        >
          <Settings className={cn("size-[18px]", pathname === "/settings" && "text-accent")} aria-hidden="true" />
          Settings
        </Link>
        <ProfileMenu user={user} />
      </div>
    </div>
  );
}

export function AppShell({ children, user }: { children: React.ReactNode; user: AppShellUser }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  // Once the palette has been opened we keep it mounted, so its lazy chunk is fetched a single
  // time (the first open) and subsequent opens/close animations are instant. Mounting is driven
  // from the open handlers (not an effect) so the chunk request starts on the opening interaction.
  const [paletteMounted, setPaletteMounted] = React.useState(false);
  const openPalette = React.useCallback(() => {
    setPaletteMounted(true);
    setPaletteOpen(true);
  }, []);

  // Cmd/Ctrl+K toggles the command palette from anywhere in the app.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteMounted(true);
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <TourProvider seen={user.completedTours ?? []}>
    <TooltipProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="min-h-svh bg-page md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-svh border-r border-line bg-sidebar md:block">
          <Navigation user={user} />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-1.5 border-b border-line bg-page/95 px-3 backdrop-blur sm:gap-2 md:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="sr-only">
                  <SheetTitle>TradeVault navigation</SheetTitle>
                  <SheetDescription>Navigate the TradeVault workspace.</SheetDescription>
                </div>
                <Navigation mobile user={user} />
              </SheetContent>
            </Sheet>

            <div className="mr-auto md:hidden">
              {/* Branding still appears in the hamburger drawer on the very smallest screens. */}
              <div className="hidden min-[360px]:block">
                <Wordmark widthClass="w-32 min-[400px]:w-36" />
              </div>
            </div>

            <Button
              variant="outline"
              className="hidden w-64 justify-start text-muted lg:inline-flex"
              onClick={openPalette}
              aria-haspopup="dialog"
            >
              <Search aria-hidden="true" />
              Search your vault
              <kbd className="ml-auto rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-faint">⌘ K</kbd>
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={openPalette}
                  aria-haspopup="dialog"
                  aria-label="Open command palette"
                >
                  <Search aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search &amp; commands (⌘K)</TooltipContent>
            </Tooltip>

            <ThemeToggle />
            <Button size="compact" aria-label="Add trade" asChild data-tour="add-trade">
              <Link href="/trades/new"><Plus aria-hidden="true" /><span className="hidden sm:inline">Add trade</span></Link>
            </Button>
          </header>

          <MarketModeSwitch currency={user.currency ?? "INR"} />

          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1540px] overflow-x-clip px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
      {paletteMounted ? <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} /> : null}
      <Toaster />
    </TooltipProvider>
    </TourProvider>
  );
}
