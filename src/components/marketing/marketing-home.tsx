import Link from "next/link";
import { ArrowRight, ListChecks, LineChart, Repeat } from "lucide-react";

import { FEATURES } from "@/components/marketing/features";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: ListChecks,
    title: "Log your trades",
    body: "Capture entries and exits with the stop, target and risk you actually planned — not what you remember later.",
  },
  {
    icon: Repeat,
    title: "Review with discipline",
    body: "Work the review queue, tag mistakes, and let the evidence — not your mood — decide what to change.",
  },
  {
    icon: LineChart,
    title: "Improve",
    body: "Watch expectancy, profit factor and your discipline trend in the right direction, per currency.",
  },
];

export function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(55%_45%_at_50%_0%,var(--accent-soft),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Private trading journal &amp; review</p>
          <h1 className="mt-4 max-w-3xl font-serif text-[clamp(2.6rem,5.4vw,4.4rem)] leading-[1.02] tracking-[-0.03em] text-ink">
            Trade with a record, not a memory.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-body">
            TradeVault is a private journal and post-trade review workspace. Capture every trade, review with
            discipline, and see what your numbers are actually telling you — with INR and USD kept strictly apart.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Get started — it&apos;s free<ArrowRight aria-hidden="true" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/features">See what&apos;s inside</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="border-t border-line">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="features-heading" className="font-serif text-3xl tracking-[-0.02em] text-ink sm:text-4xl">
              Everything a serious trading log needs
            </h2>
            <p className="mt-3 text-body">
              From the first entry to the post-trade review, TradeVault keeps your process honest and your
              numbers trustworthy.
            </p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, blurb }) => (
              <li key={title} className="rounded-lg border border-line bg-raised p-5 shadow-[var(--shadow-sm)]">
                <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft">
                  <Icon className="size-5 text-accent" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-serif text-xl text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{blurb}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link href="/features" className="inline-flex items-center gap-1 text-sm font-semibold text-accent underline-offset-2 hover:underline">
              Explore every feature<ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="border-t border-line bg-sidebar">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 id="how-heading" className="font-serif text-3xl tracking-[-0.02em] text-ink sm:text-4xl">
            A simple loop that compounds
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="rounded-lg border border-line bg-raised p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft font-serif text-lg text-accent tnum">
                    {index + 1}
                  </span>
                  <Icon className="size-5 text-muted" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-serif text-xl text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-serif text-3xl tracking-[-0.02em] text-ink sm:text-4xl">Start your journal today</h2>
          <p className="mx-auto mt-3 max-w-xl text-body">
            Free, private, and ready in under a minute — username and password only, no email required.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create your account<ArrowRight aria-hidden="true" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
