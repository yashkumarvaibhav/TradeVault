"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/login/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * The account/profile section pinned to the bottom of the sidebar (just below Settings).
 * Clicking it opens a small popover whose primary action is signing out — sign-out lives
 * here rather than in the top chrome.
 */
export function ProfileMenu({ user }: { user: { displayName: string; username: string } }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.displayName} (@${user.username})`}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-hover hover:text-ink",
            open ? "bg-hover text-ink" : "text-muted",
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-contrast"
          >
            {initialsFor(user.displayName)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <span className="truncate text-ink">{user.displayName}</span>
            <span className="truncate text-xs font-normal text-faint">@{user.username}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-faint" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[var(--radix-popover-trigger-width)] min-w-56"
      >
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium text-ink">{user.displayName}</p>
          <p className="truncate text-xs text-faint">@{user.username}</p>
        </div>
        <div className="my-1 border-t border-line" />
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          aria-current={pathname === "/settings" ? "page" : undefined}
          className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <UserRound aria-hidden="true" className="size-4" />
          Account &amp; settings
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
