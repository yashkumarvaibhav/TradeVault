import Link from "next/link";

import { AuthButton } from "@/components/auth/auth-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

const NAV = [
  { label: "Features", href: "/features" },
  { label: "FAQ", href: "/faq" },
];

/** Public marketing header — TradeVault editorial identity (teal + Newsreader/Arial, hairline). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="TradeVault home" className="rounded-md">
          <Wordmark widthClass="w-36" />
        </Link>

        <nav aria-label="Marketing navigation" className="ml-4 hidden items-center gap-1 sm:flex">
          {NAV.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <AuthButton mode="signin" variant="ghost" className="hidden sm:inline-flex">
            Sign in
          </AuthButton>
          <AuthButton mode="signup">Get started</AuthButton>
        </div>
      </div>
    </header>
  );
}
