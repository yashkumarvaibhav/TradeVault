"use client";

import * as React from "react";

import { AuthForm } from "@/app/login/auth-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

interface AuthDialogContextValue {
  open: (mode: AuthMode) => void;
}

const AuthDialogContext = React.createContext<AuthDialogContextValue | null>(null);

function useAuthDialog(): AuthDialogContextValue {
  const ctx = React.useContext(AuthDialogContext);
  if (!ctx) throw new Error("useAuthDialog must be used inside <AuthDialogProvider>");
  return ctx;
}

/**
 * Hosts a single auth modal for the public marketing surfaces. Sign in / Create account are opened
 * from the landing page as a closable popup. The dedicated /login and /signup routes are retired —
 * they now redirect here via the `?auth=signin|signup` query param, which auto-opens the modal.
 */
export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<AuthMode>("signin");

  const value = React.useMemo<AuthDialogContextValue>(
    () => ({
      open: (next) => {
        setMode(next);
        setOpen(true);
      },
    }),
    [],
  );

  // Deep-link support: `/?auth=signin` / `/?auth=signup` (used by the retired /login + /signup
  // routes and by the gated-route / sign-out redirects) auto-opens the modal, then strips the
  // param so a refresh or back-navigation does not re-open it. URL is external state, so a
  // one-shot read on mount via the stable open() callback is the right place for it.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("auth");
    if (requested !== "signin" && requested !== "signup") return;
    value.open(requested);
    params.delete("auth");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
  }, [value]);

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center pr-6 text-center">
            <Wordmark widthClass="w-40" />
            <p className="mt-2 text-sm text-muted">Your private trading journal &amp; review</p>
          </div>
          <DialogTitle className="sr-only">Sign in or create your TradeVault account</DialogTitle>
          <DialogDescription className="sr-only">
            Sign in to your account or create a new one. Username and password only — no email required.
          </DialogDescription>
          {/* Remount on each open so the form starts in the requested mode with fresh state. */}
          {open ? <AuthForm key={mode} initialMode={mode} /> : null}
          <p className="text-center text-xs leading-relaxed text-muted">
            Username and password only — no email required. You&apos;ll set up an authenticator app (TOTP) right after
            signing up; it&apos;s also how you recover your account.
          </p>
        </DialogContent>
      </Dialog>
    </AuthDialogContext.Provider>
  );
}

/** A button that opens the auth modal in the given mode. Use on the public marketing surfaces. */
export function AuthButton({
  mode,
  children,
  ...props
}: { mode: AuthMode } & Omit<React.ComponentProps<typeof Button>, "asChild" | "onClick">) {
  const { open } = useAuthDialog();
  return (
    <Button onClick={() => open(mode)} {...props}>
      {children}
    </Button>
  );
}

/** A text link (e.g. footer) that opens the auth modal in the given mode. */
export function AuthTextLink({
  mode,
  children,
  className,
}: {
  mode: AuthMode;
  children: React.ReactNode;
  className?: string;
}) {
  const { open } = useAuthDialog();
  return (
    <button
      type="button"
      onClick={() => open(mode)}
      className={cn("text-left text-sm text-muted underline-offset-2 hover:text-ink hover:underline", className)}
    >
      {children}
    </button>
  );
}
