"use client";

import Link from "next/link";
import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { setLoginTwoFactorAction } from "./two-factor-actions";

/**
 * Settings view of two-factor. Enrollment itself is mandatory and handled at /onboarding/2fa,
 * so here the authenticator is always set up (and can't be removed). The only choice is whether
 * to also require a code at every sign-in (Better Auth's `two_factor_enabled`).
 */
export function TwoFactorSettings({ enrolled, loginRequired }: { enrolled: boolean; loginRequired: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [on, setOn] = React.useState(loginRequired);

  if (!enrolled) {
    // Defensive fallback — the gate normally sends un-enrolled users to /onboarding/2fa.
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Set up an authenticator app to secure your account.</p>
        <Button asChild>
          <Link href="/onboarding/2fa">Set up two-factor</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-profit">
        <ShieldCheck className="size-4" aria-hidden="true" /> Authenticator app is set up.
      </p>
      <p className="text-sm text-muted">
        Your authenticator secures sensitive actions (changing your password and exporting or importing data)
        and recovers your account if you forget your password. It&apos;s required and can&apos;t be removed.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-page px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Require a code at every sign-in</p>
          <p className="text-sm text-muted">
            {on
              ? "You enter an authenticator code each time you sign in."
              : "You sign in with just your username and password."}
          </p>
        </div>
        <Button
          variant={on ? "outline" : "default"}
          disabled={pending}
          aria-pressed={on}
          onClick={async () => {
            setError(undefined);
            setPending(true);
            const res = await setLoginTwoFactorAction(!on);
            setPending(false);
            if (res.ok) setOn((value) => !value);
            else setError(res.error);
          }}
        >
          {pending ? "Saving…" : on ? "Turn off" : "Turn on"}
        </Button>
      </div>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
