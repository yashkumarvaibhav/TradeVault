"use client";

import Image from "next/image";
import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "My trades", icon: BarChart3 },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "Review center", icon: ShieldCheck },
  { label: "Calendar", icon: CalendarDays },
  { label: "Notes", icon: BookOpenText },
  { label: "Reports", icon: FileText },
];

function Wordmark() {
  return (
    <div className="relative h-10 w-44" aria-label="TradeVault">
      <Image
        src="/brand/wordmark-light.png"
        alt="TradeVault"
        width={700}
        height={116}
        priority
        className="brand-wordmark-light h-auto w-44"
      />
      <Image
        src="/brand/wordmark-dark.png"
        alt=""
        width={700}
        height={116}
        priority
        aria-hidden="true"
        className="brand-wordmark-dark absolute inset-0 h-auto w-44"
      />
    </div>
  );
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("border-b border-line px-5 py-5", mobile && "pr-14")}>
        <Wordmark />
        <p className="mt-2 text-xs text-muted">Trading journal & review</p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Primary navigation">
        {navItems.map(({ label, icon: Icon, active }) =>
          active ? (
            <a
              key={label}
              href="#overview"
              aria-current="page"
              className="flex min-h-11 items-center gap-3 rounded-md border border-line-strong bg-accent-soft px-3 text-sm font-semibold text-ink"
            >
              <Icon className="size-[18px] text-accent" aria-hidden="true" />
              {label}
            </a>
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
          ),
        )}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted">
          <Settings className="size-[18px]" aria-hidden="true" />
          Settings
          <span className="ml-auto text-[10px] uppercase tracking-wider text-faint">Soon</span>
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-md border border-line bg-raised p-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-ink">YK</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">Yash Kumar</span>
            <span className="block text-xs text-muted">Private workspace</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-svh bg-page md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-svh border-r border-line bg-sidebar md:block">
          <Navigation />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-page/95 px-4 backdrop-blur md:px-6">
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
                <Navigation mobile />
              </SheetContent>
            </Sheet>

            <div className="mr-auto md:hidden">
              <Wordmark />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="hidden w-64 justify-start text-muted lg:inline-flex" disabled>
                  <Search aria-hidden="true" />
                  Search your vault
                  <kbd className="ml-auto rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-faint">⌘ K</kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Global search arrives with the command palette.</TooltipContent>
            </Tooltip>

            <Chip tone="accent" className="hidden sm:inline-flex">
              <Sparkles className="size-3.5" aria-hidden="true" /> Preview
            </Chip>
            <ThemeToggle />
            <Button size="compact">
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">Add trade</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </header>

          <main id="overview" className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
