export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          TradeVault
        </p>
        <h1 className="mt-3 font-serif text-5xl font-medium tracking-tight text-ink">
          Rebuilding the journal.
        </h1>
        <p className="mt-4 text-body">
          A private, disciplined trading journal and post-trade review
          workspace — rebuilt from the ground up on Next.js.
        </p>
        <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">
            Teal accent
          </span>
          <span className="rounded-md border border-line px-4 py-2 text-sm text-body">
            Hairline border
          </span>
          <span className="tnum rounded-md border border-line px-4 py-2 text-sm text-profit">
            +1.20R
          </span>
          <span className="tnum rounded-md border border-line px-4 py-2 text-sm text-loss">
            −0.40R
          </span>
        </div>
      </div>
    </main>
  );
}
