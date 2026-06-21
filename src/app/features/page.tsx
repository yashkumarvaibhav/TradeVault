import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { FEATURES } from "@/components/marketing/features";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features · TradeVault",
  description:
    "A disciplined journal, honest per-currency analytics, Risk Studio, post-trade review, calendar & notes, and reports — INR and USD never mixed.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Features</p>
        <h1 className="mt-4 max-w-3xl font-serif text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.04] tracking-[-0.03em] text-ink">
          Built for an honest trading process
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-body">
          Every part of TradeVault exists to keep your process disciplined and your numbers trustworthy — from
          the first entry to the post-trade review.
        </p>
      </section>

      <div className="mx-auto w-full max-w-[1240px] px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line">
          {FEATURES.map(({ icon: Icon, title, blurb, points }) => (
            <section key={title} className="bg-page p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <div>
                  <span className="flex size-11 items-center justify-center rounded-md bg-accent-soft">
                    <Icon className="size-5 text-accent" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 font-serif text-2xl text-ink">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{blurb}</p>
                </div>
                <ul className="space-y-3 lg:pt-1">
                  {points.map((point) => (
                    <li key={point} className="flex gap-3 text-sm leading-relaxed text-body">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Get started — it&apos;s free<ArrowRight aria-hidden="true" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/faq">Read the FAQ</Link>
          </Button>
        </div>
      </div>
    </MarketingShell>
  );
}
