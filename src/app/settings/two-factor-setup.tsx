"use client";

import Image from "next/image";
import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { enrollConfirmAction, enrollStartAction, twoFactorDisableAction } from "./two-factor-actions";

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-sm text-danger">{message}</p>;
}

type Enroll = { qrDataUrl: string; secret: string; backupCodes: string[] };

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [enroll, setEnroll] = React.useState<Enroll | null>(null);
  // Reflect the new state immediately (the server prop catches up on next navigation).
  const [justEnabled, setJustEnabled] = React.useState(false);

  function fieldValue(form: HTMLFormElement, name: string) {
    return String(new FormData(form).get(name) ?? "");
  }

  if (enabled || justEnabled) {
    return (
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-profit">
          <ShieldCheck className="size-4" aria-hidden="true" /> Two-factor authentication is on.
        </p>
        <p className="text-sm text-muted">You&apos;ll enter a code from your authenticator app when you sign in.</p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const password = fieldValue(event.currentTarget, "password");
            setError(undefined);
            setPending(true);
            const res = await twoFactorDisableAction(password);
            setPending(false);
            if (res.ok) {
              setEnroll(null);
              setJustEnabled(false);
            } else setError(res.error);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="disable-password">Confirm password to turn off</Label>
            <Input id="disable-password" name="password" type="password" autoComplete="current-password" required className="w-64" />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Turning off…" : "Turn off"}
          </Button>
        </form>
        <ErrorText message={error} />
      </div>
    );
  }

  if (!enroll) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Add an authenticator app (TOTP) for email-free recovery. You&apos;ll scan a QR code and confirm a 6-digit code.
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const password = fieldValue(event.currentTarget, "password");
            setError(undefined);
            setPending(true);
            const res = await enrollStartAction(password);
            setPending(false);
            if (res.ok) setEnroll({ qrDataUrl: res.qrDataUrl, secret: res.secret, backupCodes: res.backupCodes });
            else setError(res.error);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="enroll-password">Confirm password to begin</Label>
            <Input id="enroll-password" name="password" type="password" autoComplete="current-password" required className="w-64" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Starting…" : "Set up two-factor"}
          </Button>
        </form>
        <ErrorText message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-4 text-sm text-body">
        <li>
          <p className="font-semibold text-ink">1. Scan this with your authenticator app</p>
          <Image src={enroll.qrDataUrl} alt="Two-factor QR code" width={180} height={180} className="mt-2 rounded-md border border-line bg-white p-2" unoptimized />
          <p className="mt-2 text-xs text-muted">
            Can&apos;t scan? Enter this key manually: <code className="rounded-sm bg-code px-1.5 py-0.5 font-mono text-ink">{enroll.secret}</code>
          </p>
        </li>
        <li>
          <p className="font-semibold text-ink">2. Save your backup codes</p>
          <p className="text-xs text-muted">Store these somewhere safe — each can be used once if you lose your device.</p>
          <ul className="mt-2 grid max-w-xs grid-cols-2 gap-1">
            {enroll.backupCodes.map((code) => (
              <li key={code} className="rounded-sm bg-code px-2 py-1 font-mono text-xs text-ink tnum">{code}</li>
            ))}
          </ul>
        </li>
        <li>
          <p className="font-semibold text-ink">3. Enter the 6-digit code to confirm</p>
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const code = fieldValue(event.currentTarget, "code");
              setError(undefined);
              setPending(true);
              const res = await enrollConfirmAction(code);
              setPending(false);
              if (res.ok) setJustEnabled(true);
              else setError(res.error);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="enroll-code">Verification code</Label>
              <Input id="enroll-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="w-40 tnum" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Confirming…" : "Confirm & turn on"}
            </Button>
          </form>
        </li>
      </ol>
      <ErrorText message={error} />
    </div>
  );
}
