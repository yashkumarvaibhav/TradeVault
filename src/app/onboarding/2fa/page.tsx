import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";
import { isTotpEnrolled } from "@/lib/auth-totp";

import { TotpEnroll } from "./totp-enroll";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up two-factor · TradeVault" };

/**
 * Mandatory authenticator setup. Reached right after sign-up and forced for any signed-in
 * account that has not yet enrolled (the gated routes redirect here via requireWorkspaceSession).
 * It does its own session check — NOT requireWorkspaceSession — to avoid a redirect loop.
 */
export default async function TwoFactorOnboardingPage() {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) redirect("/?auth=signin");
  if (await isTotpEnrolled(getDb(), session.user.id)) redirect("/");

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-page px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent-soft),transparent)]"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Wordmark widthClass="w-48" />
          <p className="mt-3 text-sm text-muted">One quick step to secure your account</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-6 shadow-[var(--shadow)] sm:p-7">
          <h1 className="font-serif text-2xl text-ink">Set up two-factor authentication</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Required to use TradeVault.</p>
          <TotpEnroll />
        </div>
      </div>
    </main>
  );
}
