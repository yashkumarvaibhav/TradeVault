"use client";

import { Toaster as Sonner, toast } from "sonner";

function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!border-line !bg-raised !text-ink !shadow-[var(--shadow)]",
          description: "!text-muted",
          actionButton: "!bg-accent !text-accent-contrast",
          cancelButton: "!bg-sidebar !text-body",
          closeButton: "!border-line !bg-raised !text-body",
        },
      }}
    />
  );
}

export { Toaster, toast };
