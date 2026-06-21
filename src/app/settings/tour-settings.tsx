"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { resetToursAction } from "@/app/tour/actions";
import { Button } from "@/components/ui/button";

/**
 * Clears the user's per-screen tour progress, then sends them to the Overview so the first tour
 * shows again immediately. A full navigation (not router.refresh) is used so the client TourProvider
 * re-mounts with the freshly emptied "seen" set.
 */
export function TourSettings() {
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        Replay the welcome walkthrough on every screen. We&apos;ll take you to the Overview to begin.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await resetToursAction();
            window.location.assign("/");
          })
        }
      >
        <Sparkles aria-hidden="true" /> {pending ? "Resetting…" : "Replay tours"}
      </Button>
    </div>
  );
}
