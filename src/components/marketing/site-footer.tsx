import Link from "next/link";

import { AuthTextLink } from "@/components/auth/auth-dialog";
import { Wordmark } from "@/components/wordmark";

const PRODUCT_LINKS = [
  { label: "Features", href: "/features" },
  { label: "FAQ", href: "/faq" },
];

const ACCOUNT_LINKS: { label: string; mode: "signin" | "signup" }[] = [
  { label: "Sign in", mode: "signin" },
  { label: "Create account", mode: "signup" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-sidebar">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <Wordmark widthClass="w-36" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A private trading journal and post-trade review workspace. Free to start, and built so INR and USD
            are never mixed.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-faint">Product</h2>
          <ul className="mt-3 space-y-2">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-faint">Account</h2>
          <ul className="mt-3 space-y-2">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.mode}>
                <AuthTextLink mode={link.mode}>{link.label}</AuthTextLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-1 px-4 py-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} TradeVault</p>
          <p>For journaling and analysis only · INR/USD only · not financial advice</p>
        </div>
      </div>
    </footer>
  );
}
