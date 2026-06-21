import Link from "next/link";

import { Wordmark } from "@/components/wordmark";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/signup" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-sidebar">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <Wordmark widthClass="w-36" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A private trading journal and post-trade review workspace. Free, and built so INR and USD are
            never mixed.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-faint">{column.heading}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
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
