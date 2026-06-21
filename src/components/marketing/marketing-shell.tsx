import * as React from "react";

import { AuthDialogProvider } from "@/components/auth/auth-dialog";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/** Public marketing page chrome: skip link + header + #main-content landmark + footer. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthDialogProvider>
      <div className="flex min-h-svh flex-col bg-page">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-clip">
          {children}
        </main>
        <SiteFooter />
      </div>
    </AuthDialogProvider>
  );
}
