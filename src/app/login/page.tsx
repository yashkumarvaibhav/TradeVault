import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { getAuth } from "@/lib/auth-server";

import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · TradeVault",
  description: "Sign in to your TradeVault trading journal, or create an account.",
};

export default async function LoginPage() {
  // If already signed in, skip the form. A failed session check (e.g. DB unreachable)
  // degrades to showing the form rather than erroring the page.
  let session = null;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    session = null;
  }
  if (session) redirect("/");

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-page px-4 py-10">
      {/* Decorative, faint teal radial accent (S12). */}
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
          <p className="mt-3 text-sm text-muted">Your private trading journal &amp; review</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-6 shadow-[var(--shadow)] sm:p-7">
          <h1 className="sr-only">Sign in to TradeVault</h1>
          <AuthForm />
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          Username and password only — no email required.
          <br />
          Account recovery uses your authenticator app (TOTP).
        </p>
      </div>
    </main>
  );
}
