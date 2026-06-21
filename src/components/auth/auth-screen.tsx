import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/app/login/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { getAuth } from "@/lib/auth-server";

type Mode = "signin" | "signup";

/**
 * Shared focused auth screen for /login and /signup. Already-signed-in visitors are sent to the
 * app (the root route renders the overview when authenticated). The "Create account" segmented
 * toggle inside AuthForm is preserved (the e2e auth setup depends on it); the dedicated routes
 * simply choose the initial mode and give each a canonical, link-friendly URL.
 */
export async function AuthScreen({ mode }: { mode: Mode }) {
  let session = null;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    session = null;
  }
  if (session) redirect("/");

  const isSignUp = mode === "signup";

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
          <Link href="/" aria-label="TradeVault home" className="rounded-md">
            <Wordmark widthClass="w-48" />
          </Link>
          <p className="mt-3 text-sm text-muted">Your private trading journal &amp; review</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-6 shadow-[var(--shadow)] sm:p-7">
          <h1 className="sr-only">{isSignUp ? "Create your TradeVault account" : "Sign in to TradeVault"}</h1>
          <AuthForm initialMode={mode} />
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-accent underline-offset-2 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to TradeVault?{" "}
              <Link href="/signup" className="font-semibold text-accent underline-offset-2 hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>

        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          Username and password only — no email required.
          <br />
          Account recovery uses your authenticator app (TOTP).
        </p>
      </div>
    </main>
  );
}
