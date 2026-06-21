"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { enrollConfirmAction, enrollStartAction } from "@/app/settings/two-factor-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-sm text-danger">{message}</p>;
}

type Enroll = { qrDataUrl: string; secret: string; backupCodes: string[] };

/**
 * Mandatory authenticator setup shown right after registration (and to legacy accounts that
 * never enrolled). The user cannot reach the app until this completes; there is no skip.
 */
export function TotpEnroll() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [enroll, setEnroll] = React.useState<Enroll | null>(null);
  const [done, setDone] = React.useState(false);

  function fieldValue(form: HTMLFormElement, name: string) {
    return String(new FormData(form).get(name) ?? "");
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-profit">
          <ShieldCheck className="size-4" aria-hidden="true" /> Authenticator set up.
        </p>
        <p className="text-sm text-muted">Taking you to your workspace…</p>
      </div>
    );
  }

  if (!enroll) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-body">
          TradeVault secures sensitive actions (password changes and data export/import) with an
          authenticator app. Set one up now to start using your account — you can choose later whether to
          also require a code at every sign-in.
        </p>
        <form
          className="space-y-3"
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
            <Label htmlFor="enroll-password">Confirm your password to begin</Label>
            <Input
              id="enroll-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Starting…" : "Set up authenticator"}
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
          <Image
            src={enroll.qrDataUrl}
            alt="Two-factor QR code"
            width={180}
            height={180}
            className="mt-2 rounded-md border border-line bg-white p-2"
            unoptimized
          />
          <p className="mt-2 text-xs text-muted">
            Can&apos;t scan? Enter this key manually:{" "}
            <code data-testid="totp-secret" className="rounded-sm bg-code px-1.5 py-0.5 font-mono text-ink">{enroll.secret}</code>
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
          <p className="font-semibold text-ink">3. Enter the 6-digit code to finish</p>
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const code = fieldValue(event.currentTarget, "code");
              setError(undefined);
              setPending(true);
              const res = await enrollConfirmAction(code);
              if (res.ok) {
                setDone(true);
                router.replace("/");
                router.refresh();
                return;
              }
              setPending(false);
              setError(res.error);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="enroll-code">Verification code</Label>
              <Input
                id="enroll-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="w-40 tnum"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Verifying…" : "Finish setup"}
            </Button>
          </form>
        </li>
      </ol>
      <ErrorText message={error} />
    </div>
  );
}
