"use client";

import * as React from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { PASSWORD_MIN_LENGTH, passwordStrength } from "@/lib/auth-policy";
import { cn } from "@/lib/utils";

import {
  signInAction,
  signUpAction,
  verifyLoginBackupAction,
  verifyLoginTotpAction,
  type AuthFormState,
} from "./actions";

type Mode = "signin" | "signup";

export function AuthForm() {
  const [mode, setMode] = React.useState<Mode>("signin");
  return (
    <div className="space-y-5">
      <SegmentedControl
        type="single"
        value={mode}
        onValueChange={(value) => value && setMode(value as Mode)}
        aria-label="Sign in or create an account"
        className="w-full"
      >
        <SegmentedControlItem value="signin" className="flex-1">Sign in</SegmentedControlItem>
        <SegmentedControlItem value="signup" className="flex-1">Create account</SegmentedControlItem>
      </SegmentedControl>

      {/* Remount per mode so each form owns a fresh action state. */}
      <AuthPanel key={mode} mode={mode} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  );
}

function TwoFactorLoginStep() {
  const [useBackup, setUseBackup] = React.useState(false);
  return <TwoFactorLoginForm key={useBackup ? "backup" : "totp"} useBackup={useBackup} onToggle={() => setUseBackup((value) => !value)} />;
}

function TwoFactorLoginForm({ useBackup, onToggle }: { useBackup: boolean; onToggle: () => void }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    useBackup ? verifyLoginBackupAction : verifyLoginTotpAction,
    { twoFactor: true },
  );
  const codeError = state.fieldErrors?.password;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <h2 className="font-serif text-lg text-ink">Two-factor authentication</h2>
        <p className="text-sm text-muted">
          {useBackup ? "Enter one of your backup codes." : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="code">{useBackup ? "Backup code" : "Authenticator code"}</Label>
        <Input
          id="code"
          name="code"
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          required
          className="tnum"
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? "code-error" : undefined}
        />
        <FieldError id="code-error" message={codeError} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify & sign in"}
      </Button>

      <button type="button" onClick={onToggle} className="text-xs text-accent underline-offset-2 hover:underline">
        {useBackup ? "Use your authenticator app instead" : "Lost your device? Use a backup code"}
      </button>
    </form>
  );
}

function AuthPanel({ mode }: { mode: Mode }) {
  const isSignUp = mode === "signup";
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    isSignUp ? signUpAction : signInAction,
    {},
  );
  const [password, setPassword] = React.useState("");
  const strength = passwordStrength(password);
  const showStrength = isSignUp && password.length > 0;

  const fieldErrors = state.fieldErrors ?? {};

  // Password was correct but the account has 2FA — switch to the code step.
  if (!isSignUp && state.twoFactor) {
    return <TwoFactorLoginStep />;
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={fieldErrors.username ? true : undefined}
          aria-describedby={fieldErrors.username ? "username-error" : undefined}
        />
        <FieldError id="username-error" message={fieldErrors.username} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={cn(fieldErrors.password && "password-error", showStrength && "password-strength") || undefined}
        />
        <FieldError id="password-error" message={fieldErrors.password} />
        {showStrength ? (
          <div id="password-strength" className="space-y-1" aria-live="polite">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    index < strength.score ? "bg-accent" : "bg-line",
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted">
              Password strength: <span className="font-semibold text-ink">{strength.label}</span>
              {strength.score < 1 ? ` · at least ${PASSWORD_MIN_LENGTH} characters` : ""}
            </p>
          </div>
        ) : (
          isSignUp ? <p className="text-xs text-muted">At least {PASSWORD_MIN_LENGTH} characters.</p> : null
        )}
      </div>

      {isSignUp ? (
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={fieldErrors.confirm ? true : undefined}
            aria-describedby={fieldErrors.confirm ? "confirm-error" : undefined}
          />
          <FieldError id="confirm-error" message={fieldErrors.confirm} />
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (isSignUp ? "Creating account…" : "Signing in…") : isSignUp ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
