"use client";

import * as React from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";

import { changePasswordAction, type ChangePasswordFormState } from "./actions";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-xs text-danger">{message}</p> : null;
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordFormState, FormData>(changePasswordAction, {});
  const formRef = React.useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  React.useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-4" noValidate>
      {state.error ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-md border border-profit/30 bg-profit/10 px-3 py-2 text-sm text-profit">{state.success}</p> : null}

      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required aria-invalid={errors.currentPassword ? true : undefined} aria-describedby={errors.currentPassword ? "current-password-error" : undefined} />
        <FieldError id="current-password-error" message={errors.currentPassword} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" required aria-invalid={errors.newPassword ? true : undefined} aria-describedby={errors.newPassword ? "new-password-error" : "new-password-help"} />
          <FieldError id="new-password-error" message={errors.newPassword} />
          {!errors.newPassword ? <p id="new-password-help" className="text-xs text-muted">At least {PASSWORD_MIN_LENGTH} characters.</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <Input id="confirm-new-password" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={errors.confirmPassword ? true : undefined} aria-describedby={errors.confirmPassword ? "confirm-new-password-error" : undefined} />
          <FieldError id="confirm-new-password-error" message={errors.confirmPassword} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="change-password-code">Authenticator code</Label>
        <Input id="change-password-code" name="code" inputMode="numeric" autoComplete="one-time-code" className="tnum max-w-48" required aria-invalid={errors.code ? true : undefined} aria-describedby={errors.code ? "change-password-code-error" : "change-password-code-help"} />
        <FieldError id="change-password-code-error" message={errors.code} />
        {!errors.code ? <p id="change-password-code-help" className="text-xs text-muted">Enter the current 6-digit code from your authenticator.</p> : null}
      </div>

      <Button type="submit" disabled={pending}>{pending ? "Changing password…" : "Change password"}</Button>
      <p className="text-xs leading-relaxed text-muted">Other signed-in devices will be signed out after the change.</p>
    </form>
  );
}
