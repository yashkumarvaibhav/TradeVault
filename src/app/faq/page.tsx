import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AuthButton } from "@/components/auth/auth-dialog";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FAQ · TradeVault",
  description:
    "Common questions about TradeVault — pricing and plans, sign-up, privacy, currency handling, importing data, and what you can log.",
  alternates: { canonical: "/faq" },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How much does TradeVault cost?",
    a: "TradeVault is free to use right now while we are in early access — no card required. Paid plans are on the way, but the core journaling and post-trade review features will always have a free tier.",
  },
  {
    q: "Do I need an email to sign up?",
    a: "No — username and password only. Account recovery uses an authenticator app (TOTP) that you can enable in Settings, so there is no email to leak or lose.",
  },
  {
    q: "Does it ever mix INR and USD?",
    a: "Never. Every metric is calculated per currency. You switch the currency you are viewing rather than seeing a meaningless combined total.",
  },
  {
    q: "What can I log?",
    a: "Equities, indices, forex, commodities, crypto and US indices — as cash/spot, futures or options. The form adapts to the asset class and instrument type, and remembers your per-instrument defaults.",
  },
  {
    q: "Is my data private, and can I take it with me?",
    a: "Each account is a single private workspace. You can export everything as JSON at any time, and generate a professional PDF report. Your data stays yours.",
  },
  {
    q: "Can I bring data from a previous version?",
    a: "Yes. Send us your TradeVault export and we will import it for you — trades, instruments, strategies, playbooks and notes are all carried across.",
  },
  {
    q: "Is this financial advice?",
    a: "No. TradeVault is a journaling and analysis tool to help you review your own trading. It is not financial advice.",
  },
];

export default function FaqPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-[820px] px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">FAQ</p>
        <h1 className="mt-4 font-serif text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.04] tracking-[-0.03em] text-ink">
          Questions, answered
        </h1>
      </section>

      <div className="mx-auto w-full max-w-[820px] px-4 pb-16 sm:px-6 lg:px-8">
        <dl className="divide-y divide-line border-y border-line">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="py-6">
              <dt className="font-serif text-xl text-ink">{q}</dt>
              <dd className="mt-2 text-base leading-relaxed text-body">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <AuthButton mode="signup" size="lg">
            Create your account<ArrowRight aria-hidden="true" />
          </AuthButton>
          <Button asChild size="lg" variant="outline">
            <Link href="/features">See the features</Link>
          </Button>
        </div>
      </div>
    </MarketingShell>
  );
}
