"use client";

import * as React from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";
import { cn } from "@/lib/utils";

import { recoverPasswordAction, type RecoveryFormState } from "./recovery-actions";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-danger">{message}</p>;
}

export function ForgotPasswordForm({ onDone }: { onDone: () => void }) {
  const [useBackup, setUseBackup] = React.useState(false);
  const [state, formAction, pending] = useActionState<RecoveryFormState, FormData>(recoverPasswordAction, {});
  const fieldErrors = state.fieldErrors ?? {};

  if (state.success) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-md border border-profit/30 bg-profit/10 px-3 py-2 text-sm text-profit">
          Password reset. Sign in with your new password.
        </p>
        <Button type="button" className="w-full" onClick={onDone}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <h2 className="font-serif text-lg text-ink">Reset your password</h2>
        <p className="text-sm text-muted">
          Verify with your authenticator app, then set a new password. Requires two-factor to be set up.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="useBackup" value={useBackup ? "1" : "0"} />

      <div className="space-y-1.5">
        <Label htmlFor="recover-username">Username</Label>
        <Input
          id="recover-username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={fieldErrors.username ? true : undefined}
          aria-describedby={fieldErrors.username ? "recover-username-error" : undefined}
        />
        <FieldError id="recover-username-error" message={fieldErrors.username} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recover-code">{useBackup ? "Backup code" : "Authenticator code"}</Label>
        <Input
          id="recover-code"
          name="code"
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          required
          className="tnum"
          aria-invalid={fieldErrors.code ? true : undefined}
          aria-describedby={fieldErrors.code ? "recover-code-error" : undefined}
        />
        <FieldError id="recover-code-error" message={fieldErrors.code} />
        <button
          type="button"
          onClick={() => setUseBackup((value) => !value)}
          className="text-xs text-accent underline-offset-2 hover:underline"
        >
          {useBackup ? "Use your authenticator app instead" : "Lost your device? Use a backup code"}
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recover-password">New password</Label>
        <Input
          id="recover-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={cn(fieldErrors.password && "recover-password-error") || undefined}
        />
        <FieldError id="recover-password-error" message={fieldErrors.password} />
        {!fieldErrors.password ? <p className="text-xs text-muted">At least {PASSWORD_MIN_LENGTH} characters.</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recover-confirm">Confirm new password</Label>
        <Input
          id="recover-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldErrors.confirm ? true : undefined}
          aria-describedby={fieldErrors.confirm ? "recover-confirm-error" : undefined}
        />
        <FieldError id="recover-confirm-error" message={fieldErrors.confirm} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
      <button type="button" onClick={onDone} className="text-xs text-muted underline-offset-2 hover:underline">
        Back to sign in
      </button>
    </form>
  );
}
