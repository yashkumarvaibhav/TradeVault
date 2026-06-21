"use client";

import * as React from "react";
import { ArrowLeftRight, Globe2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Currency } from "@/lib/domain/types";
import {
  MARKET_CURRENCY_COOKIE,
  marketSwitchLabel,
  marketWorkspaceName,
  otherMarketCurrency,
} from "@/lib/market-mode";

export function MarketModeSwitch({ currency }: { currency: Currency }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function switchMarket() {
    const next = otherMarketCurrency(currency);
    document.cookie = `${MARKET_CURRENCY_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <section data-tour="market-switch" className="border-b border-line bg-accent-soft" aria-label="Active trade market">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-raised text-accent"><Globe2 className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="font-serif text-base text-ink">{marketWorkspaceName(currency)}</p>
            <p className="text-xs text-muted">This workspace controls trade lists, money analytics, reports, and new entries.</p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={switchMarket} disabled={pending} className="h-auto min-h-11 whitespace-normal text-center sm:max-w-none">
          <ArrowLeftRight aria-hidden="true" />{pending ? "Switching…" : marketSwitchLabel(currency)}
        </Button>
      </div>
    </section>
  );
}
