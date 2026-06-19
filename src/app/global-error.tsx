"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-svh items-center justify-center bg-canvas p-6 text-body">
        <main className="w-full max-w-lg rounded-lg border border-line bg-raised p-8 text-center shadow-[var(--shadow-md)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">TradeVault</p>
          <h1 className="mt-3 font-serif text-4xl text-ink">Something interrupted this view.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Your journal data was not changed. Try the view again; if the problem continues, the diagnostic reference can help us trace it.</p>
          {error.digest && <p className="tnum mt-4 text-xs text-faint">Reference: {error.digest}</p>}
          <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-md bg-accent px-5 font-semibold text-accent-foreground shadow-[var(--shadow-sm)] hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
